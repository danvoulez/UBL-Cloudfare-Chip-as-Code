#!/usr/bin/env bash
# P0 — Observabilidade mínima (Collector + Prometheus + Grafana)
# Deploy completo de observabilidade para Gateway/RTC/Core

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OBS_DIR="${PROJECT_ROOT}/observability-starter-kit"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📊 P0 — Observabilidade Mínima"
echo "==============================="
echo ""

# Verificar Docker
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}❌ Docker não encontrado${NC}"
  echo "   Instale Docker primeiro: https://docs.docker.com/get-docker/"
  exit 1
fi

echo -e "${GREEN}✅ Docker encontrado${NC}"
echo ""

# Verificar se os arquivos de config existem
if [ ! -f "${OBS_DIR}/otel-collector/config.yaml" ]; then
  echo -e "${RED}❌ Config do OTEL Collector não encontrado${NC}"
  echo "   Esperado: ${OBS_DIR}/otel-collector/config.yaml"
  exit 1
fi

if [ ! -f "${OBS_DIR}/prometheus/prometheus.yml" ]; then
  echo -e "${RED}❌ Config do Prometheus não encontrado${NC}"
  echo "   Esperado: ${OBS_DIR}/prometheus/prometheus.yml"
  exit 1
fi

echo "1️⃣  OTEL Collector"
echo "-----------------"

# Parar container existente se houver
docker stop otel-collector 2>/dev/null || true
docker rm otel-collector 2>/dev/null || true

echo "   Iniciando OTEL Collector..."
docker run -d \
  --name otel-collector \
  --restart unless-stopped \
  -p 4317:4317 \
  -p 4318:4318 \
  -p 9464:9464 \
  -v "${OBS_DIR}/otel-collector/config.yaml:/etc/otelcol/config.yaml:ro" \
  otel/opentelemetry-collector:latest

sleep 2

if docker ps | grep -q otel-collector; then
  echo -e "   ${GREEN}✅ OTEL Collector rodando${NC}"
else
  echo -e "   ${RED}❌ Falha ao iniciar OTEL Collector${NC}"
  docker logs otel-collector 2>&1 | tail -10
  exit 1
fi

echo ""

echo "2️⃣  Prometheus"
echo "-------------"

# Parar container existente se houver
docker stop prom 2>/dev/null || true
docker rm prom 2>/dev/null || true

echo "   Iniciando Prometheus..."
docker run -d \
  --name prom \
  --restart unless-stopped \
  -p 9090:9090 \
  -v "${OBS_DIR}/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
  -v "${OBS_DIR}/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro" \
  prom/prometheus:latest \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus

sleep 2

if docker ps | grep -q prom; then
  echo -e "   ${GREEN}✅ Prometheus rodando${NC}"
else
  echo -e "   ${RED}❌ Falha ao iniciar Prometheus${NC}"
  docker logs prom 2>&1 | tail -10
  exit 1
fi

echo ""

echo "3️⃣  Grafana"
echo "----------"

# Parar container existente se houver
docker stop grafana 2>/dev/null || true
docker rm grafana 2>/dev/null || true

echo "   Iniciando Grafana..."
docker run -d \
  --name grafana \
  --restart unless-stopped \
  -p 3000:3000 \
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
  -e "GF_USERS_ALLOW_SIGN_UP=false" \
  grafana/grafana:latest

sleep 3

if docker ps | grep -q grafana; then
  echo -e "   ${GREEN}✅ Grafana rodando${NC}"
else
  echo -e "   ${RED}❌ Falha ao iniciar Grafana${NC}"
  docker logs grafana 2>&1 | tail -10
  exit 1
fi

echo ""

echo "4️⃣  Importar Dashboards"
echo "---------------------"

# Aguardar Grafana estar pronto
sleep 5

echo "   Importando dashboards..."
if [ -f "${OBS_DIR}/grafana/dashboards/20-gateway.json" ]; then
  echo "   → Gateway dashboard"
  # Nota: Importação via API requer autenticação; instruções manuais abaixo
fi

if [ -f "${OBS_DIR}/grafana/dashboards/30-core-api.json" ]; then
  echo "   → Core API dashboard"
fi

echo ""

echo "✅✅✅ Observabilidade Deployada!"
echo "================================="
echo ""
echo "📋 Serviços rodando:"
echo "   • OTEL Collector: http://localhost:4318 (OTLP/HTTP)"
echo "   • Prometheus: http://localhost:9090"
echo "   • Grafana: http://localhost:3000 (admin/admin)"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Configurar datasource Prometheus no Grafana:"
echo "   • Acesse: http://localhost:3000"
echo "   • Login: admin / admin"
echo "   • Configuration → Data Sources → Add → Prometheus"
echo "   • URL: http://prom:9090 (ou http://localhost:9090)"
echo ""
echo "2. Importar dashboards:"
echo "   • Dashboard → Import"
echo "   • Upload: ${OBS_DIR}/grafana/dashboards/20-gateway.json"
echo "   • Upload: ${OBS_DIR}/grafana/dashboards/30-core-api.json"
echo ""
echo "3. Configurar Core API para exportar métricas:"
echo "   • Adicionar exportador OTLP no vvz-core"
echo "   • Endpoint: http://localhost:4318"
echo ""
echo "📋 Proof of Done:"
echo "   curl -s https://core.voulezvous.tv/metrics | head -n 5"
echo "   # Deve retornar métricas Prometheus"
echo ""
echo "   # Verificar Prometheus scraping"
echo "   curl -s http://localhost:9090/api/v1/targets | jq"
echo ""
