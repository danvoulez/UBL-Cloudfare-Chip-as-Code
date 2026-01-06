# MCP Client — Office

CLI client para conectar a servidores MCP via registry (oficial + sub-registry do Office).

## Setup

```bash
npm install
cp .env.example .env
# Editar .env com SUBREGISTRY_URL do seu registry worker
```

## Uso

```bash
npm run dev
# ou
npm start
```

O client:
1. Busca servidores do registry oficial e sub-registry
2. Exibe cardápio interativo
3. Conecta ao servidor escolhido
4. Lista tools disponíveis
5. Testa conexão com ping (se disponível)

## Office Palette

O client funciona como "Office Palette" — um cardápio de ferramentas por sessão, permitindo que agentes escolham dinamicamente quais tools habilitar.
