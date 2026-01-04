#!/usr/bin/env bash
# Script de reorganização da codebase
# Executa movimentações de forma segura (dry-run primeiro)

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
  echo "🚀 Executando reorganização..."
  echo "=============================="
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
  mkdir -p docs/{blueprints,deploy,runbooks,status,architecture,guides}
  mkdir -p scripts/{deploy,smoke,setup,infra,utils}
  mkdir -p archive
  mkdir -p schemas/{atomic,media,office,examples}
  echo "  ✅ Estrutura criada"
else
  echo "  mkdir -p docs/{blueprints,deploy,runbooks,status,architecture,guides}"
  echo "  mkdir -p scripts/{deploy,smoke,setup,infra,utils}"
  echo "  mkdir -p archive"
  echo "  mkdir -p schemas/{atomic,media,office,examples}"
fi

echo ""
echo "2️⃣  Movendo Blueprints..."
for bp in "Blueprint"*.md; do
  if [ -f "$bp" ]; then
    # Extrair número e nome
    num=$(echo "$bp" | grep -oE '^Blueprint [0-9]+' | grep -oE '[0-9]+' | head -1)
    name=$(echo "$bp" | sed 's/^Blueprint [0-9]* — //' | sed 's/\.md$//' | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')
    if [ -n "$num" ] && [ -n "$name" ]; then
      # Formatar número com zero à esquerda (evitar erro com 08, 09)
      if [ "$num" -lt 10 ]; then
        formatted_num="0${num}"
      else
        formatted_num="${num}"
      fi
      move_file "$bp" "docs/blueprints/${formatted_num}-${name}.md"
    else
      move_file "$bp" "docs/blueprints/${bp}"
    fi
  fi
done

echo ""
echo "3️⃣  Movendo documentação de deploy..."
move_file "DEPLOY.md" "docs/deploy/deploy.md"
move_file "DEPLOY_P0.md" "docs/deploy/p0.md"
move_file "DEPLOY_P0_P1.md" "docs/deploy/p0-p1.md"
move_file "DEPLOY_P0_NEXT.md" "docs/deploy/p0-next.md"
move_file "DEPLOY_P0_EXECUTABLE.md" "docs/deploy/p0-executable.md"
move_file "DEPLOY_P0_FINAL.md" "docs/deploy/p0-final.md"
move_file "DEPLOY_PRIORITY.md" "docs/deploy/priority.md"
move_file "DEPLOY_ITEM1_FILES_R2.md" "docs/deploy/item1-files-r2.md"
move_file "QUICK_DEPLOY.md" "docs/deploy/quick-deploy.md"

echo ""
echo "4️⃣  Movendo runbooks..."
move_file "RUNBOOK_ACCESS_APPS.md" "docs/runbooks/access-apps.md"
move_file "RUNBOOK_P0_MULTITENANT.md" "docs/runbooks/p0-multitenant.md"
move_file "RUNBOOK_P0_VOULEZVOUS.md" "docs/runbooks/p0-voulezvous.md"

echo ""
echo "5️⃣  Movendo status e checklists..."
move_file "STATUS.md" "docs/status/status.md"
move_file "STATUS_DEPLOY.md" "docs/status/deploy.md"
move_file "DEPLOY_STATUS.md" "docs/status/deploy-status.md"
move_file "BLUEPRINT_STATUS.md" "docs/status/blueprint-status.md"
move_file "BLUEPRINT_CHANGES.md" "docs/status/blueprint-changes.md"
move_file "BLUEPRINT_13_IMPLEMENTATION.md" "docs/status/blueprint-13-implementation.md"
move_file "CLOUDFLARE_DEPLOYED.md" "docs/status/cloudflare-deployed.md"
move_file "P0_CHECKLIST.md" "docs/status/p0-checklist.md"
move_file "P1.1_RTC.md" "docs/status/p1.1-rtc.md"

echo ""
echo "6️⃣  Movendo outros documentos..."
move_file "CONSTITUTION.md" "docs/architecture/constitution.md"
move_file "CLEANUP.md" "docs/guides/cleanup.md"
move_file "NEXT_STEPS.md" "docs/guides/next-steps.md"
move_file "SOAK_PLAN.md" "docs/guides/soak-plan.md"
move_file "SECURITY.md" "docs/guides/security.md"
move_file "ACCESS_APPS_SETUP.md" "docs/guides/access-apps-setup.md"

echo ""
echo "7️⃣  Organizando scripts..."
# Deploy
for script in scripts/deploy-*.sh; do
  if [ -f "$script" ]; then
    move_file "$script" "scripts/deploy/$(basename "$script")"
  fi
done
move_file "scripts/build-*.sh" "scripts/deploy/" 2>/dev/null || true
move_file "scripts/runbook_*.sh" "scripts/deploy/" 2>/dev/null || true

# Smoke
for script in scripts/smoke*.sh scripts/validate-*.sh; do
  if [ -f "$script" ]; then
    move_file "$script" "scripts/smoke/$(basename "$script")"
  fi
done
move_file "smoke_chip_as_code.sh" "scripts/smoke/chip-as-code.sh"

# Setup
for script in scripts/setup-*.sh scripts/enable-*.sh scripts/disable-*.sh; do
  if [ -f "$script" ]; then
    move_file "$script" "scripts/setup/$(basename "$script")"
  fi
done

# Utils
for script in scripts/discover-*.sh scripts/fill-*.sh; do
  if [ -f "$script" ]; then
    move_file "$script" "scripts/utils/$(basename "$script")"
  fi
done

echo ""
echo "8️⃣  Movendo pastas antigas para archive..."
move_dir "nova_policy_rs" "archive/nova_policy_rs"
move_dir "nova_edge_wasm_extracted" "archive/nova_edge_wasm_extracted"
move_file "nova_edge_wasm.tar" "archive/nova_edge_wasm.tar"
move_file "nova_policy_rs.tar" "archive/nova_policy_rs.tar"
move_dir "tdln-core" "archive/tdln-core"
move_dir "proxy" "archive/proxy"
move_dir "worker" "archive/worker"
move_dir "policy-pack" "archive/policy-pack"
move_file "policy-keygen.tar.gz" "archive/policy-keygen.tar.gz"

echo ""
echo "9️⃣  Consolidando schemas..."
if [ -d "json-atomic-schemas-v1" ]; then
  move_dir "json-atomic-schemas-v1" "schemas/atomic/v1"
fi
if [ -d "json-atomic-schemas-media-pack" ]; then
  move_dir "json-atomic-schemas-media-pack" "schemas/media/pack"
fi
if [ -d "json-atomic-schemas-media-pack-v2" ]; then
  move_dir "json-atomic-schemas-media-pack-v2" "schemas/media/pack-v2"
fi

echo ""
echo "🔟 Consolidando kits/contratos..."
if [ -d "media-video-contracts-v1-ubl-api" ]; then
  move_dir "media-video-contracts-v1-ubl-api" "apps/media-api-worker/contracts"
fi
if [ -d "billing-quota-skeleton-v1" ]; then
  move_dir "billing-quota-skeleton-v1" "apps/quota-do/skeleton"
fi
if [ -d "vvz-core-systemd-pack" ]; then
  move_dir "vvz-core-systemd-pack" "infra/systemd/vvz-core"
fi

echo ""
if [ "$DRY_RUN_MODE" = true ]; then
  echo "✅✅✅ DRY RUN COMPLETO!"
  echo ""
  echo "Para executar de verdade:"
  echo "  ./scripts/reorganize.sh --execute"
else
  echo "✅✅✅ REORGANIZAÇÃO COMPLETA!"
  echo ""
  echo "📋 Próximos passos:"
  echo "   1. Verificar se tudo está correto"
  echo "   2. Atualizar referências em scripts/docs"
  echo "   3. Atualizar STRUCTURE.md"
  echo "   4. Commit das mudanças"
fi
