#!/bin/bash
set -euo pipefail

echo '{"level":"info","context":"docker.entrypoint","runtime":"alphadawg"}'

exec ./node_modules/.bin/tsx src/index.ts
