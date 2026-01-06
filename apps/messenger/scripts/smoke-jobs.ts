
// Simple smoke runner: ts-node scripts/smoke-jobs.ts
import { createMemoryJobsAdapter } from '../src/services/jobsAdapter';

async function main(){
  const adapter = createMemoryJobsAdapter();
  const job = await adapter.enqueue({ title: 'Smoke demo', kind: 'llm/generate', payload: { prompt: 'hello' } });
  console.log('enqueued:', job.id);
  adapter.subscribe((payload)=> console.log('[evt]', JSON.stringify(payload)));
  await adapter.start(job.id);
  setTimeout(()=> adapter.pause(job.id), 2500);
  setTimeout(()=> adapter.start(job.id), 4000);
  setTimeout(()=> adapter.cancel(job.id), 7000);
  setTimeout(()=> process.exit(0), 9000);
}
main().catch(e=>{ console.error(e); process.exit(1); });
