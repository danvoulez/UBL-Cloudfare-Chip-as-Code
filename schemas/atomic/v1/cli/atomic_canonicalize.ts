#!/usr/bin/env ts-node
import * as fs from 'fs';
const ORDER = ['id','ts','kind','scope','actor','refs','data','meta','sig'] as const;
function canonicalize(v:any):any{
  if(v===null || typeof v!=='object') return v;
  if(Array.isArray(v)) return v.map(canonicalize);
  const keys=Object.keys(v);
  const top=ORDER.filter(k=>keys.includes(k as any));
  const rest=keys.filter(k=>!(top as readonly string[]).includes(k)).sort();
  const out:any={};
  for(const k of [...top,...rest]) out[k]=canonicalize(v[k]);
  return out;
}
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
process.stdout.write(JSON.stringify(canonicalize(input)));
