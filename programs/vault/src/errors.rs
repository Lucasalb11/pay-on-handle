use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Vault already claimed")]
    AlreadyClaimed,
    #[msg("Vault already refunded")]
    AlreadyRefunded,
    #[msg("Vault has expired")]
    VaultExpired,
    #[msg("Vault is still active — refund only available after expiry")]
    VaultNotExpired,
    #[msg("Unauthorized: caller is not the vault sender")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Mint is not whitelisted (only SOL and USDC are supported)")]
    UnsupportedMint,
    #[msg("Vault is not in Pending status")]
    VaultNotPending,
    #[msg("Recipient handle hash does not match vault")]
    HandleMismatch,
    #[msg("Fee calculation error")]
    FeeCalculationError,
    #[msg("Invalid claim period")]
    InvalidClaimPeriod,
    #[msg("Invalid fee basis points (max 1000 = 10%)")]
    InvalidFeeBps,
}
