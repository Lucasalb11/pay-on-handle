use anchor_lang::prelude::*;

/// Platform enum encoded as u8 for compact storage.
/// 0 = Instagram, 1 = Twitter/X, 2 = WhatsApp
pub const PLATFORM_INSTAGRAM: u8 = 0;
pub const PLATFORM_TWITTER: u8 = 1;
pub const PLATFORM_WHATSAPP: u8 = 2;

pub fn is_valid_platform(p: u8) -> bool {
    p <= PLATFORM_WHATSAPP
}

#[account]
#[derive(InitSpace)]
pub struct HandleRecord {
    /// Platform identifier (0=Instagram, 1=Twitter/X, 2=WhatsApp)
    pub platform: u8,
    /// SHA-256 of normalized handle (privacy: no plaintext stored on-chain)
    pub handle_hash: [u8; 32],
    /// Wallet that controls this record (can update destination)
    pub owner: Pubkey,
    /// Wallet that receives payments for this handle
    pub destination_wallet: Pubkey,
    /// True after zkProof of handle ownership is validated
    pub verified: bool,
    pub created_at: i64,
    pub updated_at: i64,
    /// Canonical PDA bump stored for CPI efficiency (~1500 CU saved per call)
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RegistryConfig {
    pub authority: Pubkey,
    /// Program responsible for verifying zkProofs of handle ownership
    pub verification_program: Pubkey,
    pub fee_collector: Pubkey,
    pub total_handles: u64,
    pub bump: u8,
}
