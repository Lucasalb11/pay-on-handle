use anchor_lang::prelude::*;

pub const CLAIM_PERIOD_SECONDS: i64 = 7 * 24 * 60 * 60; // 7 days
pub const FEE_BPS_DEFAULT: u16 = 50; // 0.5%
pub const BPS_DIVISOR: u64 = 10_000;

/// Wrapped SOL mint — used as the mint sentinel for native SOL vaults.
pub const NATIVE_SOL_MINT: Pubkey =
    anchor_lang::prelude::pubkey!("So11111111111111111111111111111111111111112");
pub const USDC_DEVNET_MINT: Pubkey =
    anchor_lang::prelude::pubkey!("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
pub const USDC_MAINNET_MINT: Pubkey =
    anchor_lang::prelude::pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum VaultStatus {
    Pending,
    Claimed,
    Refunded,
    Expired,
}

#[account]
#[derive(InitSpace)]
pub struct PaymentVault {
    /// Wallet that created and funded this vault
    pub sender: Pubkey,
    /// SHA-256 of the recipient handle (no plaintext on-chain)
    pub recipient_handle_hash: [u8; 32],
    /// Platform (0=Instagram, 1=Twitter/X, 2=WhatsApp)
    pub recipient_platform: u8,
    /// Net amount (after fee deduction) held in escrow
    pub amount: u64,
    /// Mint for SOL use So11111111111111111111111111111111111111112
    pub mint: Pubkey,
    pub status: VaultStatus,
    pub created_at: i64,
    pub expires_at: i64,
    pub claimed_at: Option<i64>,
    /// Incrementing nonce per sender — ensures unique PDA per vault
    pub vault_nonce: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
    pub authority: Pubkey,
    pub fee_collector: Pubkey,
    /// Basis points for fee on each send (50 = 0.5%)
    pub fee_bps: u16,
    /// Seconds a vault stays claimable before sender can refund
    pub claim_period: i64,
    pub total_vaults: u64,
    pub total_volume_sol: u64,
    pub total_volume_usdc: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SenderNonce {
    pub sender: Pubkey,
    pub nonce: u64,
    pub bump: u8,
}
