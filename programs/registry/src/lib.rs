use anchor_lang::prelude::*;

declare_id!("AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX");

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod registry {
    use super::*;

    /// Initialize the global registry config. Called once by deployer.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        verification_program: Pubkey,
    ) -> Result<()> {
        instructions::initialize_config::handler(ctx, verification_program)
    }

    /// Register a social handle → wallet mapping.
    /// proof_data is a placeholder for zkProof of handle ownership.
    pub fn register_handle(
        ctx: Context<RegisterHandle>,
        platform: u8,
        handle_hash: [u8; 32],
        destination_wallet: Pubkey,
        proof_data: Vec<u8>,
    ) -> Result<()> {
        instructions::register_handle::handler(
            ctx,
            platform,
            handle_hash,
            destination_wallet,
            proof_data,
        )
    }

    /// Update the destination wallet for a registered handle.
    pub fn update_wallet(ctx: Context<UpdateWallet>, new_wallet: Pubkey) -> Result<()> {
        instructions::update_wallet::handler(ctx, new_wallet)
    }

    /// Mark a handle as verified (after zkProof validation).
    pub fn verify_handle(ctx: Context<VerifyHandle>, proof_data: Vec<u8>) -> Result<()> {
        instructions::verify_handle::handler(ctx, proof_data)
    }
}
