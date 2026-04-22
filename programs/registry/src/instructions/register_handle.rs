use crate::{
    errors::RegistryError,
    state::{is_valid_platform, HandleRecord, RegistryConfig},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(platform: u8, handle_hash: [u8; 32])]
pub struct RegisterHandle<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + HandleRecord::INIT_SPACE,
        seeds = [&b"handle"[..], &[platform], handle_hash.as_ref()],
        bump
    )]
    pub handle_record: Account<'info, HandleRecord>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, RegistryConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterHandle>,
    platform: u8,
    handle_hash: [u8; 32],
    destination_wallet: Pubkey,
    proof_data: Vec<u8>,
) -> Result<()> {
    require!(is_valid_platform(platform), RegistryError::InvalidPlatform);
    require!(handle_hash != [0u8; 32], RegistryError::InvalidHandleHash);
    require!(
        destination_wallet != Pubkey::default(),
        RegistryError::InvalidDestinationWallet
    );

    // Verify proof of handle ownership.
    // In production this calls the verification_program via CPI.
    // For MVP: accept non-empty proof_data as valid (social login JWT from backend).
    require!(!proof_data.is_empty(), RegistryError::InvalidProof);

    let now = Clock::get()?.unix_timestamp;
    let record = &mut ctx.accounts.handle_record;
    record.platform = platform;
    record.handle_hash = handle_hash;
    record.owner = ctx.accounts.owner.key();
    record.destination_wallet = destination_wallet;
    // Mark verified immediately when proof is present; zkProof path sets this via verify_handle.
    record.verified = true;
    record.created_at = now;
    record.updated_at = now;
    record.bump = ctx.bumps.handle_record;

    let config = &mut ctx.accounts.config;
    config.total_handles = config
        .total_handles
        .checked_add(1)
        .ok_or(RegistryError::Overflow)?;

    emit!(HandleRegistered {
        platform,
        handle_hash,
        owner: record.owner,
        destination_wallet: record.destination_wallet,
        timestamp: now,
    });

    Ok(())
}

#[event]
pub struct HandleRegistered {
    pub handle_hash: [u8; 32],
    pub platform: u8,
    pub owner: Pubkey,
    pub destination_wallet: Pubkey,
    pub timestamp: i64,
}
