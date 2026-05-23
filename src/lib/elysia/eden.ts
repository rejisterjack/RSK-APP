import { treaty } from '@elysia/eden';
import { type App, app } from './app';

// Server-side: direct function call (no HTTP overhead)
// Client-side: HTTP request via treaty
export const api = typeof process !== 'undefined' ? treaty(app).api : treaty<App>('').api;
