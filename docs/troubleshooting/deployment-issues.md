# Deployment Issues

This guide covers problems encountered when deploying the RAG Starter Kit to production, including Vercel, Docker, and traditional server environments.

---

## "Build fails on Vercel"

The Vercel build process fails with an error in the build log.

### Node.js version mismatch

The project requires Node.js 20 or later. The `Dockerfile` uses `node:20-alpine`. On Vercel, set the Node.js version:

1. In the Vercel dashboard, go to Project Settings > Environment Variables
2. Add `NODE_VERSION` = `20` or set it in `package.json`:

```json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

Alternatively, set it in `vercel.json` or via the Vercel dashboard under Settings > General > Node.js Version.

### Missing environment variables

The build fails if required environment variables are not set. The validation in `src/lib/env.ts` runs at application startup, not build time, but the build may fail if Prisma cannot connect to the database.

Required environment variables for Vercel deployment:

| Variable | Where to set |
|---|---|
| `DATABASE_URL` | Vercel Environment Variables |
| `NEXTAUTH_SECRET` | Vercel Environment Variables |
| `NEXTAUTH_URL` | Vercel Environment Variables |
| `OPENROUTER_API_KEY` | Vercel Environment Variables |

Set these in the Vercel dashboard under Project Settings > Environment Variables, or use the Vercel CLI:

```bash
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
```

### Build command

The `vercel.json` specifies the build command:

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install"
}
```

If `pnpm` is not available, the build fails. Vercel supports pnpm natively; ensure there is a `pnpm-lock.yaml` file in the project root.

### Prisma client generation

The `postinstall` script in `package.json` runs `prisma generate`. This should work on Vercel because the `prisma/schema.prisma` file is included in the deployment. If it fails:

```bash
# Test locally with production settings
NODE_ENV=production pnpm build
```

### Thread-stream crash

The webpack configuration in `next.config.ts` resolves `thread-stream` to `false` to prevent a crash:

```typescript
config.resolve.alias = {
  ...config.resolve.alias,
  'thread-stream': false,
};
```

If you see `thread-stream` errors in the build log, ensure this alias is present in `next.config.ts`.

---

## "Database connection in production"

The application cannot connect to the database in the production environment.

### SSL/TLS requirements

Most managed PostgreSQL providers (Neon, Supabise, AWS RDS) require SSL. Include `sslmode=require` in the connection string:

```
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

For providers that use custom CA certificates, you may need to set additional parameters. Check your provider's documentation.

### Connection pooling for serverless

Each Vercel serverless function invocation creates its own connection pool (see `src/lib/db/client.ts`). With many concurrent requests, this can exhaust database connections.

Solutions:
- **Use a connection pooler**: PgBouncer, Prisma Accelerate, or Neon's built-in pooler
- **Lower the pool size**: Set `DB_POOL_MAX=3` for serverless
- **Use Neon**: Neon's serverless driver handles connection pooling automatically

### Prisma Accelerate

For high-traffic Vercel deployments, use Prisma Accelerate as a connection pooler:

```
DATABASE_URL=prisma://accelerate.prisma-data.net/?api_key=...
```

### Connection timeout

The default connection timeout is 5 seconds (set in `src/lib/db/client.ts`). If your database is in a different region, increase it:

```
# In the DATABASE_URL query string
DATABASE_URL=postgresql://user:pass@host:5432/db?connect_timeout=10
```

### Read replica

For read-heavy workloads, configure a read replica:

```env
DATABASE_READ_REPLICA_URL=postgresql://user:pass@read-replica-host:5432/db
```

The application automatically uses the read replica for queries that go through `prismaRead` (exported from `src/lib/db/index.ts`).

---

## "Redis connection issues"

Redis is used for rate limiting and caching. In production, it uses Upstash Redis.

### Upstash URL format

The Upstash REST API URL format is:

```
UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

Get these values from the Upstash console at https://console.upstash.com.

### TLS issues

Upstash requires HTTPS. Ensure the URL starts with `https://`. If you see TLS errors, check:

- Your runtime environment supports TLS 1.2 or later
- No firewall is blocking outbound connections to `*.upstash.io`
- The URL and token are correct (no extra whitespace or line breaks in `.env`)

### Development without Redis

In development, the application falls back to an in-memory Redis mock (see `src/lib/redis.ts`). This mock supports the same interface but does not persist data across restarts.

For local Redis (via Docker):

```bash
docker compose up -d redis
```

The local Redis URL for the Docker setup:

```
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=local-dev-token
```

Note: The Docker `docker-compose.yml` exposes Redis on port 6379 (native protocol), not the Upstash REST protocol. For local development without Upstash, the in-memory mock is used automatically.

### Redis health check

```bash
# Upstash (REST API)
curl -s "${UPSTASH_REDIS_REST_URL}/ping" -H "Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}"

# Local Redis
docker compose exec redis redis-cli ping
```

---

## "Middleware edge runtime errors"

The Next.js middleware (`src/middleware.ts`) runs in the Edge Runtime, which has restrictions on what modules can be imported.

### "Module not found" errors

The Edge Runtime does not support Node.js-specific modules. The middleware file imports only Edge-compatible modules. If you modify the middleware and import a Node.js module, you will see build errors.

Common problematic modules:
- `pino` (Node.js logger): The middleware uses a custom `EdgeLogger` class instead
- `@prisma/client`: Cannot be used in middleware (the JWT verification does not require database access)
- `bcryptjs`: Not available in Edge Runtime

### Importing from `@/lib/env.ts`

The middleware does NOT import from `src/lib/env.ts` because that module validates database URLs and other server-only env vars. Instead, it reads `process.env` directly:

```typescript
const env = {
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? '',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? '',
  // ...
} as const;
```

### Bundle size limits

Vercel has a 4 MB limit for middleware bundles. If you add large imports, the build may fail. Keep the middleware lightweight.

### Web Crypto API

The middleware uses the Web Crypto API for HMAC and hashing (instead of Node.js `crypto`):

```typescript
const key = await crypto.subtle.importKey(
  'raw',
  enc.encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
);
```

This is compatible with all Edge Runtime environments.

---

## "Docker container won't start"

The Docker container exits immediately or fails the health check.

### Check container logs

```bash
docker compose logs app
# Or for a standalone container:
docker logs rag-starter-kit
```

### Missing environment variables

The container requires environment variables at runtime (not just build time). Pass them via `--env-file`:

```bash
docker run -p 3000:3000 --env-file .env rag-starter-kit
```

Or use Docker Compose and add the env_file directive.

### Health check failure

The `Dockerfile` includes a health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

If the health check fails:
1. Check if the application is listening on port 3000
2. Verify `/api/health` endpoint returns 200
3. Check that the database is accessible from the container

### Database connectivity from Docker

If the database is running on the host machine (not in Docker Compose), use `host.docker.internal`:

```
DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/ragdb
```

On Linux, add `--add-host=host.docker.internal:host-gateway` to the Docker run command.

### Standalone build issues

The `Dockerfile` uses Next.js standalone output mode (configured in `next.config.ts`):

```typescript
output: "standalone",
```

This produces a minimal build in `.next/standalone/`. The Dockerfile copies:
- `.next/standalone/` as the server
- `.next/static/` for static assets
- `public/` for public files
- `prisma/` for runtime migrations
- `src/generated/` for the Prisma client

If any of these are missing, the container may fail to start. Ensure the build completes successfully before building the Docker image.

### Memory limits

Node.js has a default heap size limit. For large documents or many concurrent requests, increase it:

```bash
docker run -e NODE_OPTIONS="--max-old-space-size=2048" -p 3000:3000 rag-starter-kit
```

---

## Still having issues?

1. Check the deployment platform's build logs for the specific error.
2. Verify all required environment variables are set in the deployment environment (not just in `.env`).
3. Test the build locally with production settings: `NODE_ENV=production pnpm build`
4. For Vercel, check the function logs in the Vercel dashboard under the Functions tab.
5. For Docker, check `docker logs` and `docker compose logs`.
6. Open a GitHub issue with the deployment target, the full error output, and the relevant configuration.
