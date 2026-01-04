#!/usr/bin/env ts-node
import * as fs from 'fs';
import nacl from 'tweetnacl';
const seed=Buffer.alloc(32,7);
const kp=nacl.sign.keyPair.fromSeed(seed);
const sig=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
function canonical(v:any):any{
  const ORDER=['id','ts','kind','scope','actor','refs','data','meta','sig'];
  if(v===null || typeof v!=='object') return v;
  if(Array.isArray(v)) return v.map(canonical);
  const keys=Object.keys(v);
  const top=ORDER.filter(k=>keys.includes(k));
  const rest=keys.filter(k=>!top.includes(k)).sort();
  const out:any={};
  for(const k of [...top,...rest]) out[k]=canonical(v[k]);
  return out;
}
for (const f of ['../examples/office_tool_call.json','../examples/office_event.json','../examples/office_handover.json']){
  const obj=JSON.parse(fs.readFileSync(f,'utf8'));
  obj.sig=sig;
  const bytes=Buffer.from(JSON.stringify(canonical(obj)),'utf8');
  const ok=nacl.sign.detached.verify(bytes, Buffer.from(sig.value,'base64'), kp.publicKey);
  console.log({sample:f, ok});
}
