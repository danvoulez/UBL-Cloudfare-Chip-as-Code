#!/usr/bin/env ts-node
import * as fs from 'fs';
import nacl from 'tweetnacl';
const bytes=fs.readFileSync(process.argv[2]);
const seed=Buffer.alloc(32,7); // demo only
const kp=nacl.sign.keyPair.fromSeed(seed);
const sig=nacl.sign.detached(bytes,kp.secretKey);
const value=Buffer.from(sig).toString('base64');
console.log(JSON.stringify({alg:'Ed25519',kid:'demo:seed7',value},null,2));
