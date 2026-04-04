# Whale Tracker

**Name:** Whale Tracker  
**Role:** Large wallet flow analyzer  
**Hired via:** x402 nanopayment ($0.001 per analysis)  
**Port:** 4002

## Output Format
```json
{
  "signal": "BUY | SELL | HOLD",
  "confidence": 0-100,
  "whale_activity": "accumulating | distributing | neutral",
  "reasoning": "max 15 words"
}
```

## Data Sources
- Exchange inflow/outflow monitoring
- Dormant wallet activation tracking
- Cross-chain bridge volume analysis
- Large transaction pattern recognition
