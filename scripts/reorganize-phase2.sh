#!/usr/bin/env bash
# Reorganização Fase 2 — Root e Nomes
# Melhora organização do root e renomeia pastas

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DRY_RUN="${1:-}"

if [ "$DRY_RUN" != "--execute" ]; then
  echo "🔍 DRY RUN — Mostrando o que será feito"
  echo "======================================"
  echo ""
  echo "Para executar de verdade, rode:"
  echo "  $0 --execute"
  echo ""
  DRY_RUN_MODE=true
else
  echo "🚀 Executando Reorganização Fase 2..."
  echo "====================================="
  echo ""
  DRY_RUN_MODE=false
fi

cd "$PROJECT_ROOT"

# Função helper
move_file() {
  local src="$1"
  local dst="$2"
  
  if [ "$DRY_RUN_MODE" = true ]; then
    if [ -e "$src" ]; then
      echo "  mv '$src' -> '$dst'"
    fi
  else
    if [ -e "$src" ]; then
      mkdir -p "$(dirname "$dst")"
      mv "$src" "$dst"
      echo "  ✅ $src -> $dst"
    fi
  fi
}

move_dir() {
  local src="$1"
  local dst="$2"
  
  if [ "$DRY_RUN_MODE" = true ]; then
    if [ -d "$src" ]; then
      echo "  mv '$src' -> '$dst'"
    fi
  else
    if [ -d "$src" ]; then
      mkdir -p "$(dirname "$dst")"
      mv "$src" "$dst"
      echo "  ✅ $src -> $dst"
    fi
  fi
}

echo "1️⃣  Criando estrutura de diretórios..."
if [ "$DRY_RUN_MODE" = false ]; then
  mkdir -p crates workers
  echo "  ✅ Estrutura criada"
else
  echo "  mkdir -p crates workers"
fi

echo ""
echo "2️⃣  Movendo crates Rust para crates/..."
move_dir "policy-engine" "crates/policy-engine"
move_dir "policy-proxy" "crates/policy-proxy"
move_dir "policy-signer" "crates/policy-signer"
move_dir "policy-keygen" "crates/policy-keygen"

echo ""
echo "3️⃣  Movendo workers para workers/..."
move_dir "policy-worker" "workers/policy-worker"
move_dir "rtc-worker" "workers/rtc-worker"

echo ""
echo "4️⃣  Consolidando infra/observability..."
if [ -d "observability-starter-kit" ]; then
  if [ "$DRY_RUN_MODE" = false ]; then
    if [ -d "infra/observability" ]; then
      # Mover conteúdo se já existir
      echo "  ⚠️  infra/observability já existe, mesclando..."
      cp -r observability-starter-kit/* infra/observability/ 2>/dev/null || true
      rm -rf observability-starter-kit
      echo "  ✅ Conteúdo mesclado em infra/observability"
    else
      move_dir "observability-starter-kit" "infra/observability"
    fi
  else
    echo "  mv 'observability-starter-kit' -> 'infra/observability'"
  fi
fi

echo ""
echo "5️⃣  Movendo kits para apps/..."
move_dir "vvz-cloudflare-kit" "apps/vvz-cloudflare-kit"

echo ""
echo "6️⃣  Movendo STRUCTURE.md para docs/..."
move_file "STRUCTURE.md" "docs/structure.md"

echo ""
echo "7️⃣  Atualizando Cargo.toml..."
if [ "$DRY_RUN_MODE" = false ] && [ -f "Cargo.toml" ]; then
  # Backup
  cp Cargo.toml Cargo.toml.bak
  
  # Atualizar paths (usando sed)
  sed -i '' 's|"policy-engine"|"crates/policy-engine"|g' Cargo.toml 2>/dev/null || \
  sed -i 's|"policy-engine"|"crates/policy-engine"|g' Cargo.toml
  sed -i '' 's|"policy-proxy"|"crates/policy-proxy"|g' Cargo.toml 2>/dev/null || \
  sed -i 's|"policy-proxy"|"crates/policy-proxy"|g' Cargo.toml
  sed -i '' 's|"policy-signer"|"crates/policy-signer"|g' Cargo.toml 2>/dev/null || \
  sed -i 's|"policy-signer"|"crates/policy-signer"|g' Cargo.toml
  sed -i '' 's|"policy-keygen"|"crates/policy-keygen"|g' Cargo.toml 2>/dev/null || \
  sed -i 's|"policy-keygen"|"crates/policy-keygen"|g' Cargo.toml
  
  echo "  ✅ Cargo.toml atualizado"
else
  echo "  Atualizar paths em Cargo.toml:"
  echo "    policy-engine -> crates/policy-engine"
  echo "    policy-proxy -> crates/policy-proxy"
  echo "    policy-signer -> crates/policy-signer"
  echo "    policy-keygen -> crates/policy-keygen"
fi

echo ""
if [ "$DRY_RUN_MODE" = true ]; then
  echo "✅✅✅ DRY RUN COMPLETO!"
  echo ""
  echo "Para executar de verdade:"
  echo "  ./scripts/reorganize-phase2.sh --execute"
else
  echo "✅✅✅ REORGANIZAÇÃO FASE 2 COMPLETA!"
  echo ""
  echo "📋 Próximos passos:"
  echo "   1. Verificar se tudo está correto"
  echo "   2. Atualizar referências em scripts (se necessário)"
  echo "   3. Testar build: cargo build"
  echo "   4. Commit das mudanças"
fi
