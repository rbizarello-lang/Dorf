#!/bin/bash
# Instala as dependências no início de cada sessão do Claude Code na web,
# para que typecheck, testes e build funcionem logo de cara.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
# npm install (e não npm ci) aproveita o node_modules guardado no cache do contêiner.
npm install --no-audit --no-fund
