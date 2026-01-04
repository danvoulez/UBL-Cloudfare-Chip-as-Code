# Rotação Blue/Green de Chaves ES256

**Algoritmo:** ES256 (ECDSA P-256)  
**Estratégia:** Blue/Green com período de graça

---

## 🔄 Processo de Rotação

### Passo 1: Gerar nova chave (next)

```bash
# Gerar jwt-v2
./infra/identity/scripts/generate-es256-keypair.sh /etc/ubl/keys jwt-v2
```

**Output:**
- `/etc/ubl/keys/jwt_es256_jwt-v2_priv.pem`
- `/etc/ubl/keys/jwt_es256_jwt-v2_pub.pem`

### Passo 2: Publicar JWKS com ambas as chaves

**Opção A: Atualizar Core API para servir ambas**

Modifique `apps/core-api/src/auth/jwks.rs` para:
1. Carregar `jwt-v1` e `jwt-v2` do disco
2. Incluir ambas no array `keys` do JWKS
3. Manter `jwt-v1` como primeira (compatibilidade)

**Opção B: Gerar JWKS estático temporariamente**

```bash
./infra/identity/scripts/generate-jwks.sh /etc/ubl/keys jwt-v1 jwt-v2 > /tmp/jwks.json
# Publicar em KV ou endpoint estático
```

### Passo 3: Atualizar Core API para assinar com jwt-v2

1. **Carregar chave privada jwt-v2:**
   ```bash
   export JWT_ES256_PRIV_PATH=/etc/ubl/keys/jwt_es256_jwt-v2_priv.pem
   export JWT_KID=jwt-v2
   ```

2. **Reiniciar Core API:**
   ```bash
   sudo systemctl restart core-api
   ```

3. **Verificar:**
   ```bash
   curl -s http://127.0.0.1:9458/auth/jwks.json | jq '.keys[] | {kid, alg}'
   # Deve mostrar jwt-v1 e jwt-v2, ambos ES256
   ```

### Passo 4: Manter compatibilidade

- **Período de graça:** ≥ 30 dias (ou > TTL máximo de token)
- **Verificadores:** Aceitam ambos `kid` durante transição
- **Tokens antigos:** Continuam válidos até expirarem

### Passo 5: Remover chave antiga

**Após período de graça:**

1. **Remover jwt-v1 do JWKS:**
   - Atualizar `jwks.rs` para servir apenas `jwt-v2`
   - Ou remover `jwt-v1` do array `keys`

2. **Arquivar chave privada:**
   ```bash
   sudo mv /etc/ubl/keys/jwt_es256_jwt-v1_priv.pem /etc/ubl/keys/archive/
   ```

3. **Verificar:**
   ```bash
   curl -s http://127.0.0.1:9458/auth/jwks.json | jq '.keys[] | .kid'
   # Deve mostrar apenas jwt-v2
   ```

---

## ✅ Checklist de Rotação

- [ ] Chave `jwt-v2` gerada e guardada (600)
- [ ] JWKS atualizado com ambas as chaves
- [ ] Core API reiniciado com `jwt-v2` como signer
- [ ] Tokens novos emitidos com `kid: jwt-v2`
- [ ] Tokens antigos ainda validam (jwt-v1 no JWKS)
- [ ] Período de graça aguardado (≥ 30 dias)
- [ ] Chave antiga removida do JWKS
- [ ] Chave privada antiga arquivada

---

## 🚨 Rollback (emergência)

Se precisar reverter para `jwt-v1`:

1. **Restaurar signer:**
   ```bash
   export JWT_ES256_PRIV_PATH=/etc/ubl/keys/jwt_es256_jwt-v1_priv.pem
   export JWT_KID=jwt-v1
   sudo systemctl restart core-api
   ```

2. **Verificar:**
   ```bash
   curl -s http://127.0.0.1:9458/auth/jwks.json | jq '.keys[0].kid'
   # Deve mostrar jwt-v1
   ```

---

## 📚 Referências

- **Blueprint 06** — Identity & Access (Gateway)
- **RFC 7517** — JSON Web Key (JWK)
- **RFC 7519** — JSON Web Token (JWT)
