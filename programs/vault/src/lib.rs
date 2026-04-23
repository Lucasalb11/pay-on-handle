use anchor_lang::prelude::*;

declare_id!("EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H");

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod vault {
    use super::*;

    pub fn initialize_vault_config(
        ctx: Context<InitializeVaultConfig>,
        fee_collector: Pubkey,
    ) -> Result<()> {
        instructions::initialize_config::handler(ctx, fee_collector)
    }

    pub fn update_vault_config(
        ctx: Context<UpdateVaultConfig>,
        new_fee_bps: u16,
        new_claim_period: i64,
    ) -> Result<()> {
        instructions::initialize_config::update_handler(ctx, new_fee_bps, new_claim_period)
    }

    pub fn update_fee_collector(
        ctx: Context<UpdateFeeCollector>,
        new_fee_collector: Pubkey,
    ) -> Result<()> {
        instructions::initialize_config::update_fee_collector_handler(ctx, new_fee_collector)
    }

    /// Create an escrow vault sending native SOL.
    pub fn create_sol_vault(
        ctx: Context<CreateSolVault>,
        recipient_platform: u8,
        recipient_handle_hash: [u8; 32],
        vault_nonce: u64,
        gross_amount: u64,
    ) -> Result<()> {
        instructions::create_vault::create_sol_vault_handler(
            ctx,
            recipient_platform,
            recipient_handle_hash,
            vault_nonce,
            gross_amount,
        )
    }

    /// Create an escrow vault sending SPL tokens (USDC).
    pub fn create_spl_vault(
        ctx: Context<CreateSplVault>,
        recipient_platform: u8,
        recipient_handle_hash: [u8; 32],
        vault_nonce: u64,
        gross_amount: u64,
    ) -> Result<()> {
        instructions::create_vault::create_spl_vault_handler(
            ctx,
            recipient_platform,
            recipient_handle_hash,
            vault_nonce,
            gross_amount,
        )
    }

    /// Claim a SOL vault — caller proves handle ownership.
    pub fn claim_sol_vault(
        ctx: Context<ClaimSolVault>,
        recipient_handle_hash: [u8; 32],
    ) -> Result<()> {
        instructions::claim_vault::claim_sol_vault_handler(ctx, recipient_handle_hash)
    }

    /// Claim a SPL vault — caller proves handle ownership.
    pub fn claim_spl_vault(
        ctx: Context<ClaimSplVault>,
        recipient_handle_hash: [u8; 32],
    ) -> Result<()> {
        instructions::claim_vault::claim_spl_vault_handler(ctx, recipient_handle_hash)
    }

    /// Refund a SOL vault after expiry. Only original sender.
    pub fn refund_sol_vault(ctx: Context<RefundSolVault>) -> Result<()> {
        instructions::refund_vault::refund_sol_vault_handler(ctx)
    }

    /// Refund a SPL vault after expiry. Only original sender.
    pub fn refund_spl_vault(ctx: Context<RefundSplVault>) -> Result<()> {
        instructions::refund_vault::refund_spl_vault_handler(ctx)
    }
}
