use crate::{
    errors::VaultError,
    state::{VaultConfig, CLAIM_PERIOD_SECONDS, FEE_BPS_DEFAULT},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeVaultConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + VaultConfig::INIT_SPACE,
        seeds = [b"vault_config"],
        bump
    )]
    pub config: Account<'info, VaultConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeVaultConfig>, fee_collector: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.fee_collector = fee_collector;
    config.fee_bps = FEE_BPS_DEFAULT;
    config.claim_period = CLAIM_PERIOD_SECONDS;
    config.total_vaults = 0;
    config.total_volume_sol = 0;
    config.total_volume_usdc = 0;
    config.bump = ctx.bumps.config;

    emit!(VaultConfigInitialized {
        authority: config.authority,
        fee_collector,
        fee_bps: config.fee_bps,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[event]
pub struct VaultConfigInitialized {
    pub authority: Pubkey,
    pub fee_collector: Pubkey,
    pub fee_bps: u16,
    pub timestamp: i64,
}

// ── update_fee_collector ───────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct UpdateFeeCollector<'info> {
    #[account(
        mut,
        seeds = [b"vault_config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, VaultConfig>,

    pub authority: Signer<'info>,
}

pub fn update_fee_collector_handler(
    ctx: Context<UpdateFeeCollector>,
    new_fee_collector: Pubkey,
) -> Result<()> {
    ctx.accounts.config.fee_collector = new_fee_collector;
    Ok(())
}

// ── update_config lives here too ──────────────────────────────────────────────

#[derive(Accounts)]
pub struct UpdateVaultConfig<'info> {
    #[account(
        mut,
        seeds = [b"vault_config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, VaultConfig>,

    pub authority: Signer<'info>,
}

pub fn update_handler(
    ctx: Context<UpdateVaultConfig>,
    new_fee_bps: u16,
    new_claim_period: i64,
) -> Result<()> {
    require!(new_fee_bps <= 1_000, VaultError::InvalidFeeBps);
    require!(new_claim_period > 0, VaultError::InvalidClaimPeriod);

    let config = &mut ctx.accounts.config;
    config.fee_bps = new_fee_bps;
    config.claim_period = new_claim_period;

    Ok(())
}
