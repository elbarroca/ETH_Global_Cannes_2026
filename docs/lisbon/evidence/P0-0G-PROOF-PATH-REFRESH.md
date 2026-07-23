# P0 0G Proof-Path Refresh

Observed: `2026-07-23T23:30:13Z`

Start SHA: `de6dec613bb6d0e5c3861d3de0953cf258f61c85`

Status: `NARROW_STATIC_REMEDIATION_PATH_FOUND; PRODUCT_AND_LIVE_BLOCKED`

## Storage decision

The latest official TypeScript Storage package remains unsuitable for the protected path:

- Package: `@0gfoundation/0g-storage-ts-sdk@1.2.10`.
- License: ISC.
- Git commit: `2b4b07d5011eeed64f0f2c7a63639e3df6198932`.
- Registry integrity: `sha512-Ry2VXsFAZMSQMkv0hX6QPA9CyF+Eed2z3BNHggaQDi/pZTc9WP55MzGVTGiqxbNhCMwyJRrhTRJBY0ZAGgkkAw==`.
- [`Downloader.ts` lines 458-465](https://github.com/0gfoundation/0g-storage-ts-sdk/blob/2b4b07d5011eeed64f0f2c7a63639e3df6198932/src.ts/transfer/Downloader.ts#L458-L465) mark proof checking as a TODO and ignore `_proof`.

An official proof-capable path exists in Go:

- Module: `github.com/0gfoundation/0g-storage-client@v1.3.0`.
- Commit: `0c725b7323c1a134cdbf8071c4974549024bfef2`.
- License: [MIT](https://github.com/0gfoundation/0g-storage-client/blob/0c725b7323c1a134cdbf8071c4974549024bfef2/LICENSE).
- API: [`Download(ctx, root, filename, withProof)`](https://github.com/0gfoundation/0g-storage-client/blob/0c725b7323c1a134cdbf8071c4974549024bfef2/transfer/downloader.go#L25-L27) with `withProof=true`.
- CLI: [`download --proof`](https://github.com/0gfoundation/0g-storage-client/blob/0c725b7323c1a134cdbf8071c4974549024bfef2/cmd/download.go#L47-L47).
- Segment path: [`DownloadSegmentWithProofByTxSeq` plus `Proof.ValidateHash`](https://github.com/0gfoundation/0g-storage-client/blob/0c725b7323c1a134cdbf8071c4974549024bfef2/transfer/download_parallel.go#L164-L184).
- Final binding: [recompute the complete file Merkle root and reject mismatch](https://github.com/0gfoundation/0g-storage-client/blob/0c725b7323c1a134cdbf8071c4974549024bfef2/transfer/downloader.go#L270-L290).

The repository does not install or invoke this Go verifier. Static path discovery narrows P0; it does not pass product or live gates.

## Compute requirement

The installed Compute flow verifies separately fetched signed text but does not bind that text to the content returned by the application. A3 must:

1. accept only the service-documented identifier for the exact provider/model request;
2. fetch one response-signature object for that identifier;
3. verify that same object against the acknowledged service signer;
4. require byte-exact equality between its signed text and the returned assistant content;
5. throw before returning content on a missing field, mismatch, false/null result, or exception.

Official implementation evidence: [`processResponse`](https://github.com/0gfoundation/0g-serving-user-broker/blob/bff29131f953d5b08ad0c40eb805d8e00408df77/src.ts/sdk/inference/broker/response.ts#L25-L102) separately fetches and verifies `ResponseSignature.text`; it does not compare that text with application-returned content.

## Gate

P0 remains blocked until the pinned Go verifier is integrated or invoked as the release-pinned verifier and fatal Compute equality is implemented. Promotion additionally requires separately authorized proof-enabled readback, one-byte/root tamper refusal, public identifiers, and release-SHA-bound live evidence.

No dependency, product file, provider call, credential, root, proof, transaction, spend, push, deployment, or claim promotion was created by this refresh.
