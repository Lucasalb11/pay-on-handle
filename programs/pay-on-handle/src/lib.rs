use anchor_lang::prelude::*;

declare_id!("E9kZ4zEmvwXJKTy5SP53WozGPNRSj1duzJxgeV9iMbPk");

#[program]
pub mod pay_on_handle {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
