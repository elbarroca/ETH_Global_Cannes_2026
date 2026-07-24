---
name: source-command-test-cycle
description: Run the deterministic protected AlphaDawg local verification contract.
---

# Test the protected local cycle

Read `docs/lisbon/GOALS.md` and current evidence. Run only local deterministic
checks:

```bash
npm run validate:env
npx prisma validate
npx prisma generate
npx tsx scripts/test-migrations.ts
npm run lint
npm run typecheck
npm test
npm run test:auth
npm run test:kernel
npm run test:go
npm run test:a3
npm run test:a4
npm run test:a5
npm run test:integration
npm run test:e2e
npm run test:resilience
npm run test:redaction
npm run test:boot
npm run scan:secrets
bash -n docker-entrypoint.sh
npm run build
```

Run `npm run test:playwright` when the sprint or release gate includes browser
behavior. Report exact commands, exit codes, and counts. Stop at the first
deterministic failure and return the owning layer to C0.

Never run setup, funding, webhook, sponsor, wallet, deployment, form,
transaction, or managed migration commands without exact current
authorization. Local fixtures are not live proof.
