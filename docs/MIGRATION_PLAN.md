# Plano de Migração: Proxy Python → Rust

## Decisão Recomendada: **Migração Direta para Rust**

### Por quê?

1. **Fonte única de verdade**: O proxy Rust já usa `tdln-core` nativamente, garantindo decisões idênticas ao Worker (WASM)
2. **Performance**: Rust nativo é mais rápido e eficiente que Python
3. **Supply chain**: Menos dependências, binário estático, SBoM mais simples
4. **Manutenção**: Um único código base (tdln-core) para edge e proxy

### Estratégia de Migração

#### Opção A: Migração Direta (Recomendada)

**Vantagens:**
- ✅ Implementação limpa desde o início
- ✅ Sem complexidade de manter dois sistemas
- ✅ Testes mais simples (um único código)

**Passos:**
1. Deploy do proxy Rust em ambiente de staging
2. Validação de PoD (mesmas decisões que Worker)
3. Cutover em janela de manutenção
4. Monitoramento por 24h

**Tempo estimado:** 2-3 dias

#### Opção B: Canário (Se necessário)

**Quando usar:**
- Se houver dependências críticas no Python que precisam ser migradas gradualmente
- Se o ambiente de staging não for idêntico ao produção

**Passos:**
1. Deploy Rust em paralelo (porta diferente)
2. Roteamento canário (10% → 50% → 100%)
3. Comparação de métricas (eval_ms, decisões)
4. Desligar Python após validação

**Tempo estimado:** 1-2 semanas

### Checklist de Migração

- [ ] Build do proxy Rust (`make build-proxy`)
- [ ] Testes unitários passando
- [ ] Validação PoD: 3 cenários (hacker/admin/break-glass)
- [ ] Configuração systemd/service
- [ ] Métricas Prometheus funcionando
- [ ] Ledger local gravando corretamente
- [ ] Sincronização break-glass com Worker
- [ ] Load balancer configurado
- [ ] Monitoramento ativo (p95 < 2ms)
- [ ] Rollback plan documentado

### Rollback Plan

Se necessário voltar ao Python:
1. Parar serviço Rust
2. Reiniciar serviço Python
3. Atualizar LB para apontar para Python
4. Investigar problema no Rust

**Tempo de rollback:** < 5 minutos

## Recomendação Final

**Migrar direto para Rust** porque:
- O código já está pronto e testado
- A arquitetura é mais simples (menos pontos de falha)
- O ganho de performance e segurança justifica a migração
- O risco é baixo (proxy é stateless, fácil rollback)

Se houver alguma dependência crítica no Python que não foi identificada, podemos fazer canário. Mas na maioria dos casos, migração direta é a melhor opção.
