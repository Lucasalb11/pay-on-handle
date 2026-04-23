use crate::{
    errors::VaultError,
    state::{
        PaymentVault, VaultStatus, HR_DEST_WALLET_OFFSET, HR_VERIFIED_OFFSET, NATIVE_SOL_MINT,
        REGISTRY_PROGRAM_ID,
    },
};
use anchor_lang::prelude::*;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Mint;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer as SplTransfer};

/// Claim a SOL vault. `handle_record` must be the HandleRecord PDA owned by
/// the registry program, with `destination_wallet == claimer`.
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

    /// CHECK: validated in handler — PDA owned by registry, destination_wallet == claimer
    #[account(owner = REGISTRY_PROGRAM_ID @ VaultError::InvalidHandleRecord)]
    pub handle_record: UncheckedAccount<'info>,

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

    // Guard: handle_record PDA must derive from the vault's stored target.
    let (expected_pda, _) = Pubkey::find_program_address(
        &[
            b"handle",
            &[vault.recipient_platform],
            vault.recipient_handle_hash.as_ref(),
        ],
        &REGISTRY_PROGRAM_ID,
    );
    require!(
        ctx.accounts.handle_record.key() == expected_pda,
        VaultError::InvalidHandleRecord
    );

    // Guard: handle must be verified and destination_wallet must equal claimer.
    let hr = ctx.accounts.handle_record.try_borrow_data()?;
    require!(
        hr.len() > HR_VERIFIED_OFFSET,
        VaultError::InvalidHandleRecord
    );
    require!(hr[HR_VERIFIED_OFFSET] == 1, VaultError::HandleNotVerified);
    let dest_bytes: [u8; 32] = hr[HR_DEST_WALLET_OFFSET..HR_DEST_WALLET_OFFSET + 32]
        .try_into()
        .map_err(|_| error!(VaultError::InvalidHandleRecord))?;
    require!(
        Pubkey::from(dest_bytes) == ctx.accounts.claimer.key(),
        VaultError::Unauthorized
    );
    drop(hr);

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

    /// CHECK: validated in handler — PDA owned by registry, destination_wallet == claimer
    #[account(owner = REGISTRY_PROGRAM_ID @ VaultError::InvalidHandleRecord)]
    pub handle_record: UncheckedAccount<'info>,

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

    // Guard: handle_record PDA must derive from the vault's stored target.
    let (expected_pda, _) = Pubkey::find_program_address(
        &[
            b"handle",
            &[vault.recipient_platform],
            vault.recipient_handle_hash.as_ref(),
        ],
        &REGISTRY_PROGRAM_ID,
    );
    require!(
        ctx.accounts.handle_record.key() == expected_pda,
        VaultError::InvalidHandleRecord
    );

    // Guard: handle must be verified and destination_wallet must equal claimer.
    let hr = ctx.accounts.handle_record.try_borrow_data()?;
    require!(
        hr.len() > HR_VERIFIED_OFFSET,
        VaultError::InvalidHandleRecord
    );
    require!(hr[HR_VERIFIED_OFFSET] == 1, VaultError::HandleNotVerified);
    let dest_bytes: [u8; 32] = hr[HR_DEST_WALLET_OFFSET..HR_DEST_WALLET_OFFSET + 32]
        .try_into()
        .map_err(|_| error!(VaultError::InvalidHandleRecord))?;
    require!(
        Pubkey::from(dest_bytes) == ctx.accounts.claimer.key(),
        VaultError::Unauthorized
    );
    drop(hr);

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
