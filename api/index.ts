import { createApiApp } from '../server/apiApp';

// Vercel Serverless Function entry point (handles /api/* and /healthz via vercel.json rewrites)
const app = createApiApp({ enableCompression: false });

export default app;
