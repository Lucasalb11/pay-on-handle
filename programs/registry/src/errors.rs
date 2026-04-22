use anchor_lang::prelude::*;

#[error_code]
pub enum RegistryError {
    #[msg("Handle already registered for this platform")]
    HandleAlreadyRegistered,
    #[msg("Invalid platform identifier")]
    InvalidPlatform,
    #[msg("Handle hash cannot be zero")]
    InvalidHandleHash,
    #[msg("Proof data is invalid or expired")]
    InvalidProof,
    #[msg("Unauthorized: caller is not the record owner")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Handle not yet verified")]
    NotVerified,
    #[msg("Destination wallet cannot be the zero address")]
    InvalidDestinationWallet,
}
