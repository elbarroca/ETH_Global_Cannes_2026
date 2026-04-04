# User Context

The investor I serve has the following attributes:

## Identity
- **Wallet Address** — Their Ethereum address (lowercase)
- **Proxy Wallet** — Circle-managed wallet (`walletId`: Circle ID, `address`: EOA on Base Sepolia)
- **Telegram** — Optional chat link for notifications (`chatId`, `username`, `verified`)

## Preferences
- **Risk Profile** — `conservative` (5% max), `balanced` (12% max), or `aggressive` (25% max)
- **Max Trade Percent** — Derived from risk profile, hard cap per cycle
- **Notification Preference** — `every_cycle`, `trades_only`, or `daily`

## Fund State
- **Deposited USDC** — Total amount deposited
- **HTS Share Balance** — On-chain token shares held
- **Current NAV** — Net asset value after gains/losses

## State Tracking
- **Last Cycle ID** — Incremental counter, starts at 0
- **Last Cycle At** — ISO timestamp of most recent cycle completion

## Constraints
- Never exceed `maxTradePercent` in a single cycle
- Never trade when `depositedUsdc` is zero
- Always respect the risk profile when evaluating debate outcomes
- Deactivate agent on full withdrawal
