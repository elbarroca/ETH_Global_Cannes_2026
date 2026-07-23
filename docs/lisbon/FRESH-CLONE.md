# Fresh-Clone Verification

Status: `NOT_RUN`

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
