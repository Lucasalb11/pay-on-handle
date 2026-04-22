use crate::{errors::RegistryError, state::HandleRecord};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct VerifyHandle<'info> {
    #[account(
        mut,
        seeds = [&b"handle"[..], &[handle_record.platform], handle_record.handle_hash.as_ref()],
        bump = handle_record.bump,
        has_one = owner @ RegistryError::Unauthorized
    )]
    pub handle_record: Account<'info, HandleRecord>,

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<VerifyHandle>, proof_data: Vec<u8>) -> Result<()> {
    // Production: CPI into verification_program to validate zkProof.
    // MVP: accept non-empty proof as valid (server-side JWT validation done in backend).
    require!(!proof_data.is_empty(), RegistryError::InvalidProof);

    let record = &mut ctx.accounts.handle_record;
    record.verified = true;
    record.updated_at = Clock::get()?.unix_timestamp;

    emit!(HandleVerified {
        handle_hash: record.handle_hash,
        timestamp: record.updated_at,
    });

    Ok(())
}

#[event]
pub struct HandleVerified {
    pub handle_hash: [u8; 32],
    pub timestamp: i64,
}
