use crate::{
    errors::VaultError,
    state::{PaymentVault, VaultStatus, NATIVE_SOL_MINT},
};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Mint;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer as SplTransfer};

#[derive(Accounts)]
pub struct RefundSolVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", sender.key().as_ref(), &vault.vault_nonce.to_le_bytes()],
        bump = vault.bump,
        has_one = sender @ VaultError::Unauthorized,
        constraint = vault.status == VaultStatus::Pending @ VaultError::VaultNotPending,
        constraint = vault.mint == NATIVE_SOL_MINT @ VaultError::UnsupportedMint,
        close = sender,
    )]
    pub vault: Account<'info, PaymentVault>,

    #[account(mut)]
    pub sender: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn refund_sol_vault_handler(ctx: Context<RefundSolVault>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        now > ctx.accounts.vault.expires_at,
        VaultError::VaultNotExpired
    );

    let amount = ctx.accounts.vault.amount;

    let vault = &mut ctx.accounts.vault;
    vault.status = VaultStatus::Refunded;

    **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.sender.try_borrow_mut_lamports()? += amount;

    emit!(VaultRefunded {
        vault_id: vault.vault_nonce,
        sender: ctx.accounts.sender.key(),
        amount,
        timestamp: now,
    });

    Ok(())
}

// ── SPL refund ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct RefundSplVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", sender.key().as_ref(), &vault.vault_nonce.to_le_bytes()],
        bump = vault.bump,
        has_one = sender @ VaultError::Unauthorized,
        constraint = vault.status == VaultStatus::Pending @ VaultError::VaultNotPending,
        close = sender,
    )]
    pub vault: Account<'info, PaymentVault>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = sender,
    )]
    pub sender_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub sender: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn refund_spl_vault_handler(ctx: Context<RefundSplVault>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        now > ctx.accounts.vault.expires_at,
        VaultError::VaultNotExpired
    );

    let amount = ctx.accounts.vault.amount;
    let vault_nonce = ctx.accounts.vault.vault_nonce;
    let sender_key = ctx.accounts.vault.sender;
    let vault_bump = ctx.accounts.vault.bump;

    let vault = &mut ctx.accounts.vault;
    vault.status = VaultStatus::Refunded;

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
                to: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault_token_account.to_account_info(),
            destination: ctx.accounts.sender.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer_seeds,
    ))?;

    emit!(VaultRefunded {
        vault_id: vault_nonce,
        sender: ctx.accounts.sender.key(),
        amount,
        timestamp: now,
    });

    Ok(())
}

#[event]
pub struct VaultRefunded {
    pub vault_id: u64,
    pub sender: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
