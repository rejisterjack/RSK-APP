import { treaty } from '@elysia/eden'
import type { App } from './app'

const isServer = typeof process !== 'undefined'

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return ''
}

// Server-side: direct function call via treaty(app)
// Client-side: HTTP request via treaty(baseUrl)
// The prefix '/api/elysia' becomes the first path segment on the treaty client
export const api = isServer
  ? (() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('./app')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return treaty(app) as any
    })()
  : treaty<App>(getBaseUrl())
