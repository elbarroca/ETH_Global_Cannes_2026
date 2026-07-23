# Fresh-Clone Verification

Status: `BLOCKED_A0_NO_RELEASE_SHA`

Current state: local `developer` exists, but `origin/developer` does not and push is `NOT_AUTHORIZED`. The control-only checkout is not a release candidate. A local clean clone may be used after A4 when a frozen core SHA exists; the remote fresh-clone proof remains blocked until the exact push is authorized.

Run only on the frozen remote release candidate:

```bash
git clone --branch developer https://github.com/elbarroca/ETH_Global_Cannes_2026.git alphadawg-release-check
cd alphadawg-release-check
npm ci --legacy-peer-deps
npx prisma validate
npm run lint
npm run typecheck
npm test
npm run build
```

Record release SHA, Node/npm versions, migration fixtures, exits, durations, start/readiness, secret scan, and two complete demo replays. Do not mark passed before the remote branch exists.
