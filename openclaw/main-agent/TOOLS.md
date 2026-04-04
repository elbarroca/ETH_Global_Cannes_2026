# Available Tools

## hire-specialists
**Protocol:** x402 nanopayment over HTTP  
**Endpoints:** `localhost:4001/analyze`, `localhost:4002/analyze`, `localhost:4003/analyze`  
**Cost:** $0.001 USDC per call (Base Sepolia)  
**Returns:** `{name, signal, confidence, attestationHash, teeVerified}`

## run-debate
**Protocol:** 0G Sealed Inference (TEE)  
**Stages:** Alpha → Risk → Executor (2s delay between each)  
**Model:** 7B parameter model via 0G Compute  
**Returns:** `{content, parsed, attestationHash, teeVerified}` per stage

## log-hedera
**Protocol:** Hedera Consensus Service (HCS)  
**Operation:** TopicMessageSubmitTransaction (freeze → sign → execute)  
**Constraint:** Payload must be under 1024 bytes  
**Returns:** `{seqNum, hashscanUrl}`

## store-0g
**Protocol:** 0G Storage via Indexer  
**Operation:** Upload JSON blob, receive root hash  
**Returns:** `rootHash` (string)

## update-inft
**Protocol:** 0G Chain smart contract (ethers v6)  
**Operation:** `updateMetadata(tokenId, newMetadataHash, newURI)`  
**Config:** `INFT_CONTRACT_ADDRESS` env var  
**Trigger:** Only if user has iNFT token and storage upload succeeded

## save-cycle
**Protocol:** Prisma ORM → PostgreSQL  
**Operations:** `logCycleRecord()` saves full cycle data, `logAction()` saves per-step events  
**Tables:** `cycles`, `agent_actions`  
**Config:** `DATABASE_URL` env var

## notify-telegram
**Protocol:** Telegram Bot API  
**Operation:** Send formatted message to user's chat ID  
**Content:** Cycle number, decision, TEE verification status, Hashscan link
