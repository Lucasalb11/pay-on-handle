use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};

declare_id!("CxMBNwbovsvLTe7bSuca8X26WS7PW81VtDu3oLyfSG6s");

#[program]
pub mod fee_collector {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, treasury: Pubkey) -> Result<()> {
        let collector = &mut ctx.accounts.fee_collector;
        collector.authority = ctx.accounts.authority.key();
        collector.treasury = treasury;
        collector.total_collected_sol = 0;
        collector.total_collected_usdc = 0;
        collector.bump = ctx.bumps.fee_collector;
        Ok(())
    }

    /// Withdraw accumulated SOL fees to treasury.
    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        require!(amount > 0, FeeError::ZeroAmount);

        **ctx
            .accounts
            .fee_collector
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += amount;

        emit!(FeesWithdrawn {
            mint: Pubkey::default(),
            amount,
            treasury: ctx.accounts.treasury.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Withdraw accumulated SPL token fees (USDC) to treasury.
    pub fn withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
        require!(amount > 0, FeeError::ZeroAmount);

        let bump = ctx.accounts.fee_collector.bump;
        let seeds = &[b"fee_collector" as &[u8], &[bump]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.fee_token_account.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.fee_collector.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        emit!(FeesWithdrawn {
            mint: ctx.accounts.mint.key(),
            amount,
            treasury: ctx.accounts.treasury_token_account.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct FeeCollectorAccount {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub total_collected_sol: u64,
    pub total_collected_usdc: u64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + FeeCollectorAccount::INIT_SPACE,
        seeds = [b"fee_collector"],
        bump
    )]
    pub fee_collector: Account<'info, FeeCollectorAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(
        mut,
        seeds = [b"fee_collector"],
        bump = fee_collector.bump,
        has_one = authority
    )]
    pub fee_collector: Account<'info, FeeCollectorAccount>,

    /// CHECK: validated via has_one on treasury field
    #[account(
        mut,
        constraint = treasury.key() == fee_collector.treasury
    )]
    pub treasury: UncheckedAccount<'info>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawSpl<'info> {
    #[account(
        mut,
        seeds = [b"fee_collector"],
        bump = fee_collector.bump,
        has_one = authority
    )]
    pub fee_collector: Account<'info, FeeCollectorAccount>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = fee_collector,
    )]
    pub fee_token_account: Account<'info, TokenAccount>,

    /// CHECK: validated against fee_collector.treasury
    #[account(constraint = treasury.key() == fee_collector.treasury @ FeeError::Unauthorized)]
    pub treasury: UncheckedAccount<'info>,

    /// Treasury's ATA for this mint — must be pre-created.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum FeeError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Unauthorized")]
    Unauthorized,
}

#[event]
pub struct FeesWithdrawn {
    pub mint: Pubkey,
    pub amount: u64,
    pub treasury: Pubkey,
    pub timestamp: i64,
}
