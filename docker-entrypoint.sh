#!/bin/bash
set -euo pipefail

echo '{"level":"info","context":"docker.entrypoint","runtime":"alphadawg"}'

# `src/index.ts` is the only process allowed to start durable workers. Protected
# mode is the default; legacy capabilities require ALPHADAWG_RUNTIME_MODE=legacy
# plus ENABLE_BACKGROUND_WORKERS=true and are dynamically imported only then.
exec tsx src/index.ts
