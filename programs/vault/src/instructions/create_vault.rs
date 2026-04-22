use crate::{
    errors::VaultError,
    state::{PaymentVault, SenderNonce, VaultConfig, VaultStatus, BPS_DIVISOR, NATIVE_SOL_MINT},
};
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Mint;
use anchor_spl::token::{self, Token, TokenAccount, Transfer as SplTransfer};

/// Create a vault sending native SOL.
#[derive(Accounts)]
#[instruction(recipient_platform: u8, recipient_handle_hash: [u8; 32], vault_nonce: u64)]
pub struct CreateSolVault<'info> {
    #[account(
        init,
        payer = sender,
        space = 8 + PaymentVault::INIT_SPACE,
        seeds = [b"vault", sender.key().as_ref(), &vault_nonce.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, PaymentVault>,

    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + SenderNonce::INIT_SPACE,
        seeds = [b"nonce", sender.key().as_ref()],
        bump
    )]
    pub sender_nonce: Account<'info, SenderNonce>,

    #[account(
        seeds = [b"vault_config"],
        bump = config.bump
    )]
    pub config: Account<'info, VaultConfig>,

    /// CHECK: fee_collector is validated against config
    #[account(
        mut,
        constraint = fee_collector.key() == config.fee_collector
    )]
    pub fee_collector: UncheckedAccount<'info>,

    #[account(mut)]
    pub sender: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_sol_vault_handler(
    ctx: Context<CreateSolVault>,
    recipient_platform: u8,
    recipient_handle_hash: [u8; 32],
    vault_nonce: u64,
    gross_amount: u64,
) -> Result<()> {
    require!(gross_amount > 0, VaultError::ZeroAmount);
    require!(
        recipient_handle_hash != [0u8; 32],
        VaultError::HandleMismatch
    );

    let config = &ctx.accounts.config;
    let now = Clock::get()?.unix_timestamp;

    // Calculate fee and net amount using checked arithmetic.
    let fee = (gross_amount as u128)
        .checked_mul(config.fee_bps as u128)
        .ok_or(VaultError::Overflow)?
        .checked_div(BPS_DIVISOR as u128)
        .ok_or(VaultError::FeeCalculationError)? as u64;

    let net_amount = gross_amount.checked_sub(fee).ok_or(VaultError::Underflow)?;

    // Transfer gross_amount from sender to vault (vault PDA holds it).
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        net_amount,
    )?;

    // Transfer fee to fee_collector.
    if fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.sender.to_account_info(),
                    to: ctx.accounts.fee_collector.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    // Initialise / increment sender nonce.
    let nonce_account = &mut ctx.accounts.sender_nonce;
    if nonce_account.sender == Pubkey::default() {
        nonce_account.sender = ctx.accounts.sender.key();
        nonce_account.nonce = 0;
        nonce_account.bump = ctx.bumps.sender_nonce;
    }
    nonce_account.nonce = nonce_account
        .nonce
        .checked_add(1)
        .ok_or(VaultError::Overflow)?;

    // Populate vault.
    let vault = &mut ctx.accounts.vault;
    vault.sender = ctx.accounts.sender.key();
    vault.recipient_handle_hash = recipient_handle_hash;
    vault.recipient_platform = recipient_platform;
    vault.amount = net_amount;
    vault.mint = NATIVE_SOL_MINT;
    vault.status = VaultStatus::Pending;
    vault.created_at = now;
    vault.expires_at = now
        .checked_add(config.claim_period)
        .ok_or(VaultError::Overflow)?;
    vault.claimed_at = None;
    vault.vault_nonce = vault_nonce;
    vault.bump = ctx.bumps.vault;

    // Update global stats.
    let config = &mut ctx.accounts.config;
    config.total_vaults = config
        .total_vaults
        .checked_add(1)
        .ok_or(VaultError::Overflow)?;
    config.total_volume_sol = config
        .total_volume_sol
        .checked_add(gross_amount)
        .ok_or(VaultError::Overflow)?;

    emit!(VaultCreated {
        vault_id: vault_nonce,
        sender: vault.sender,
        recipient_handle_hash,
        recipient_platform,
        amount: net_amount,
        fee,
        mint: vault.mint,
        expires_at: vault.expires_at,
        timestamp: now,
    });

    Ok(())
}

// ── SPL token (USDC) variant ──────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(recipient_platform: u8, recipient_handle_hash: [u8; 32], vault_nonce: u64)]
pub struct CreateSplVault<'info> {
    #[account(
        init,
        payer = sender,
        space = 8 + PaymentVault::INIT_SPACE,
        seeds = [b"vault", sender.key().as_ref(), &vault_nonce.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, PaymentVault>,

    /// Vault's associated token account — owned by the vault PDA.
    #[account(
        init,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + SenderNonce::INIT_SPACE,
        seeds = [b"nonce", sender.key().as_ref()],
        bump
    )]
    pub sender_nonce: Account<'info, SenderNonce>,

    #[account(
        seeds = [b"vault_config"],
        bump = config.bump
    )]
    pub config: Account<'info, VaultConfig>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = sender,
    )]
    pub sender_token_account: Account<'info, TokenAccount>,

    /// Fee collector's associated token account for this mint.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config.fee_collector,
    )]
    pub fee_collector_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub sender: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn create_spl_vault_handler(
    ctx: Context<CreateSplVault>,
    recipient_platform: u8,
    recipient_handle_hash: [u8; 32],
    vault_nonce: u64,
    gross_amount: u64,
) -> Result<()> {
    require!(gross_amount > 0, VaultError::ZeroAmount);
    require!(
        recipient_handle_hash != [0u8; 32],
        VaultError::HandleMismatch
    );

    let config = &ctx.accounts.config;
    let now = Clock::get()?.unix_timestamp;

    let fee = (gross_amount as u128)
        .checked_mul(config.fee_bps as u128)
        .ok_or(VaultError::Overflow)?
        .checked_div(BPS_DIVISOR as u128)
        .ok_or(VaultError::FeeCalculationError)? as u64;

    let net_amount = gross_amount.checked_sub(fee).ok_or(VaultError::Underflow)?;

    // Transfer net amount to vault token account.
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
            },
        ),
        net_amount,
    )?;

    // Transfer fee to fee_collector token account.
    if fee > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.sender_token_account.to_account_info(),
                    to: ctx.accounts.fee_collector_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    let nonce_account = &mut ctx.accounts.sender_nonce;
    if nonce_account.sender == Pubkey::default() {
        nonce_account.sender = ctx.accounts.sender.key();
        nonce_account.nonce = 0;
        nonce_account.bump = ctx.bumps.sender_nonce;
    }
    nonce_account.nonce = nonce_account
        .nonce
        .checked_add(1)
        .ok_or(VaultError::Overflow)?;

    let vault = &mut ctx.accounts.vault;
    vault.sender = ctx.accounts.sender.key();
    vault.recipient_handle_hash = recipient_handle_hash;
    vault.recipient_platform = recipient_platform;
    vault.amount = net_amount;
    vault.mint = ctx.accounts.mint.key();
    vault.status = VaultStatus::Pending;
    vault.created_at = now;
    vault.expires_at = now
        .checked_add(config.claim_period)
        .ok_or(VaultError::Overflow)?;
    vault.claimed_at = None;
    vault.vault_nonce = vault_nonce;
    vault.bump = ctx.bumps.vault;

    let config = &mut ctx.accounts.config;
    config.total_vaults = config
        .total_vaults
        .checked_add(1)
        .ok_or(VaultError::Overflow)?;
    config.total_volume_usdc = config
        .total_volume_usdc
        .checked_add(gross_amount)
        .ok_or(VaultError::Overflow)?;

    emit!(VaultCreated {
        vault_id: vault_nonce,
        sender: vault.sender,
        recipient_handle_hash,
        recipient_platform,
        amount: net_amount,
        fee,
        mint: vault.mint,
        expires_at: vault.expires_at,
        timestamp: now,
    });

    Ok(())
}

#[event]
pub struct VaultCreated {
    pub vault_id: u64,
    pub sender: Pubkey,
    pub recipient_handle_hash: [u8; 32],
    pub recipient_platform: u8,
    pub amount: u64,
    pub fee: u64,
    pub mint: Pubkey,
    pub expires_at: i64,
    pub timestamp: i64,
}
