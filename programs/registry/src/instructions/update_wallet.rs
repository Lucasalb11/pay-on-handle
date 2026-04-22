use crate::{errors::RegistryError, state::HandleRecord};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateWallet<'info> {
    #[account(
        mut,
        seeds = [&b"handle"[..], &[handle_record.platform], handle_record.handle_hash.as_ref()],
        bump = handle_record.bump,
        has_one = owner @ RegistryError::Unauthorized
    )]
    pub handle_record: Account<'info, HandleRecord>,

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateWallet>, new_wallet: Pubkey) -> Result<()> {
    require!(
        new_wallet != Pubkey::default(),
        RegistryError::InvalidDestinationWallet
    );

    let record = &mut ctx.accounts.handle_record;
    let old_wallet = record.destination_wallet;
    record.destination_wallet = new_wallet;
    record.updated_at = Clock::get()?.unix_timestamp;

    emit!(WalletUpdated {
        handle_hash: record.handle_hash,
        old_wallet,
        new_wallet,
        timestamp: record.updated_at,
    });

    Ok(())
}

#[event]
pub struct WalletUpdated {
    pub handle_hash: [u8; 32],
    pub old_wallet: Pubkey,
    pub new_wallet: Pubkey,
    pub timestamp: i64,
}
