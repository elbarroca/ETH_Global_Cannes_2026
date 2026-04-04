# Heartbeat Configuration

**Interval:** 5 minutes (300 seconds)  
**Trigger:** Automatic via `setInterval` in Node.js runtime  
**On-chain proof:** Hedera Scheduled Transaction attempted after each run (non-fatal)

## Behavior

1. Fetch all active users from database
2. For each active user, execute a full investment cycle
3. After each cycle, send Telegram notification
4. Schedule next heartbeat as Hedera Scheduled Transaction (proof of cadence)
5. If no active users, skip cycle and log

## Error Handling

- Per-user errors do not stop the loop — other users still get their cycles
- Scheduler failures are non-fatal — logged as warnings
- If all services are down, cycles fail gracefully with mock data
