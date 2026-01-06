
import { createMemoryJobsAdapter } from './src/services/jobsAdapter';
// @ts-ignore
window.__OFFICE__ = window.__OFFICE__ || {};
// @ts-ignore
window.__OFFICE__.jobs = createMemoryJobsAdapter();
console.log('[wiring] window.__OFFICE__.jobs ready');
