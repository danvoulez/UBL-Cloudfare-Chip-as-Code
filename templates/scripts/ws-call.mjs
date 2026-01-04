#!/usr/bin/env node
/**
 * Blueprint 16 — WebSocket MCP Client Helper
 * Uso: echo '{"jsonrpc":"2.0",...}' | node scripts/ws-call.mjs
 */

import { WebSocket } from 'ws';

const MCP_WS_URL = process.env.MCP_WS_URL || 'wss://api.ubl.agency/mcp';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  const json = input.trim();
  if (!json) {
    console.error('❌ JSON vazio');
    process.exit(1);
  }

  const ws = new WebSocket(MCP_WS_URL);
  
  ws.on('open', () => {
    ws.send(json);
  });

  ws.on('message', (data) => {
    console.log(data.toString());
    ws.close();
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
    process.exit(1);
  });

  setTimeout(() => {
    console.error('❌ Timeout');
    ws.close();
    process.exit(1);
  }, 5000);
});
