use crate::{
    errors::VaultError,
    state::{PaymentVault, VaultStatus, NATIVE_SOL_MINT},
};
use anchor_lang::prelude::*;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Mint;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer as SplTransfer};

/// Claim a SOL vault. Claimer proves ownership of the handle via
/// (a) having the wallet registered in the Registry, or (b) providing proof_data
/// validated off-chain by the relayer before submitting this tx.
#[derive(Accounts)]
pub struct ClaimSolVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.sender.as_ref(), &vault.vault_nonce.to_le_bytes()],
        bump = vault.bump,
        constraint = vault.status == VaultStatus::Pending @ VaultError::VaultNotPending,
        constraint = vault.mint == NATIVE_SOL_MINT @ VaultError::UnsupportedMint,
    )]
    pub vault: Account<'info, PaymentVault>,

    #[account(mut)]
    pub claimer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn claim_sol_vault_handler(
    ctx: Context<ClaimSolVault>,
    recipient_handle_hash: [u8; 32],
) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let now = Clock::get()?.unix_timestamp;

    // Guard: vault must not be expired.
    require!(now <= vault.expires_at, VaultError::VaultExpired);

    // Guard: handle hash must match what was stored at send time.
    require!(
        vault.recipient_handle_hash == recipient_handle_hash,
        VaultError::HandleMismatch
    );

    let amount = vault.amount;

    // Update state before transfer (checks-effects-interactions).
    let vault = &mut ctx.accounts.vault;
    vault.status = VaultStatus::Claimed;
    vault.claimed_at = Some(now);

    // Release lamports from vault PDA to claimer.
    // We drain the vault account using a raw lamport transfer (vault is a PDA).
    **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.claimer.try_borrow_mut_lamports()? += amount;

    emit!(VaultClaimed {
        vault_id: vault.vault_nonce,
        claimer: ctx.accounts.claimer.key(),
        amount,
        timestamp: now,
    });

    Ok(())
}

// ── SPL token claim ───────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ClaimSplVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.sender.as_ref(), &vault.vault_nonce.to_le_bytes()],
        bump = vault.bump,
        constraint = vault.status == VaultStatus::Pending @ VaultError::VaultNotPending,
    )]
    pub vault: Account<'info, PaymentVault>,

    /// Vault's token account (source).
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    /// Claimer receives tokens here.
    #[account(
        init_if_needed,
        payer = claimer,
        associated_token::mint = mint,
        associated_token::authority = claimer,
    )]
    pub claimer_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub claimer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn claim_spl_vault_handler(
    ctx: Context<ClaimSplVault>,
    recipient_handle_hash: [u8; 32],
) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let now = Clock::get()?.unix_timestamp;

    require!(now <= vault.expires_at, VaultError::VaultExpired);
    require!(
        vault.recipient_handle_hash == recipient_handle_hash,
        VaultError::HandleMismatch
    );

    let amount = vault.amount;
    let vault_nonce = vault.vault_nonce;
    let sender_key = vault.sender;
    let vault_bump = vault.bump;

    // Effects first.
    let vault = &mut ctx.accounts.vault;
    vault.status = VaultStatus::Claimed;
    vault.claimed_at = Some(now);

    // PDA signer seeds for vault authority.
    let nonce_bytes = vault_nonce.to_le_bytes();
    let seeds = &[
        b"vault" as &[u8],
        sender_key.as_ref(),
        &nonce_bytes,
        &[vault_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SplTransfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.claimer_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // Close vault token account; rent goes back to claimer.
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault_token_account.to_account_info(),
            destination: ctx.accounts.claimer.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer_seeds,
    ))?;

    emit!(VaultClaimed {
        vault_id: vault_nonce,
        claimer: ctx.accounts.claimer.key(),
        amount,
        timestamp: now,
    });

    Ok(())
}

#[event]
pub struct VaultClaimed {
    pub vault_id: u64,
    pub claimer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
