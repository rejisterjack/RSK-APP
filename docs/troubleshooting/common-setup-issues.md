# Common Setup Issues

This guide covers the most frequently encountered problems when setting up the RAG Starter Kit for the first time.

---

## "Cannot connect to database"

The application fails at startup with an error like `P1001: Can't reach database server` or `connection refused`.

### PostgreSQL is not running

If you are using the local Docker setup, verify the container is running:

```bash
docker compose ps
```

You should see `rag-postgres` with a status of `Up (healthy)`. If it is not running:

```bash
docker compose up -d postgres
```

Wait for the health check to pass (about 10 seconds), then verify connectivity:

```bash
docker compose exec postgres pg_isready -U postgres
```

### Wrong connection string

The `DATABASE_URL` in your `.env` file must match your PostgreSQL configuration. For the local Docker setup, the correct value is:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ragdb
```

Common mistakes:
- Using `127.0.0.1` instead of `localhost` (usually fine, but some configs differ)
- Missing the database name (`/ragdb` at the end)
- Wrong port (default is 5432)
- Special characters in the password not URL-encoded

For external databases (Neon, Supabase, AWS RDS), copy the connection string from the provider dashboard. Make sure the database has the `pgvector` extension installed.

### SSL/TLS issues

If you see errors like `self-signed certificate` or `SSL connection required`, you may need to adjust the SSL mode in the connection string:

```
# For local development (no SSL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ragdb?sslmode=disable

# For managed databases that require SSL
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

For Neon and other cloud providers that mandate SSL, use `sslmode=require`. The connection pool in `src/lib/db/client.ts` uses the `pg` Pool which respects these query parameters.

### Connection pool exhaustion

The Prisma client in `src/lib/db/client.ts` creates a connection pool with defaults based on the environment:

- **Development**: 3 connections max
- **Serverless (Vercel)**: 5 connections max
- **Production server**: 15 connections max

Override with the `DB_POOL_MAX` environment variable:

```
DB_POOL_MAX=10
```

For serverless deployments, use a connection pooler like PgBouncer or Prisma Accelerate. Each function invocation creates its own pool.

---

## "Environment variable X is missing"

The application validates all environment variables at startup using Zod in `src/lib/env.ts`. If a required variable is missing or invalid, the application will print a detailed error and refuse to start.

### Checking your .env file

First, verify the file exists:

```bash
ls -la .env
```

If it does not exist, copy the example:

```bash
cp .env.example .env
```

Then fill in the required values. At minimum, you need:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ragdb
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
OPENROUTER_API_KEY=sk-or-v1-...
```

### Required vs optional variables

**Required** (application will not start without these):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Min 32 characters. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Full URL including protocol and port |
| `OPENROUTER_API_KEY` | Get from https://openrouter.ai/keys |

**Required in production only**:

| Variable | Notes |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Redis for rate limiting. In-memory fallback used in dev |
| `UPSTASH_REDIS_REST_TOKEN` | Paired with the URL above |
| `ENCRYPTION_MASTER_KEY` | Min 32 characters. Needed for SAML keys, webhook secrets |

**Optional** (features disabled if not set):

| Variable | Default | Notes |
|---|---|---|
| `EMBEDDING_PROVIDER` | `google` | Options: `google`, `openai`, `ollama` |
| `EMBEDDING_DIMENSIONS` | `768` | Must match the pgvector column dimension |
| `GOOGLE_GENERATIVE_AI_API_KEY` | - | Required for Google embeddings |
| `OPENAI_API_KEY` | - | Required for OpenAI embeddings |
| `OLLAMA_BASE_URL` | - | Required for local Ollama embeddings |
| `CLOUDINARY_URL` | - | File storage. Local filesystem used in dev |
| `RESEND_API_KEY` | - | Transactional email. Console fallback in dev |
| `AUTH_GITHUB_ID` | - | GitHub OAuth. Login page shows without it |
| `AUTH_GITHUB_SECRET` | - | Paired with GitHub OAuth ID |
| `AUTH_GOOGLE_ID` | - | Google OAuth |
| `AUTH_GOOGLE_SECRET` | - | Paired with Google OAuth ID |

### Generating secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_MASTER_KEY
openssl rand -base64 32
```

---

## "Port 3000 already in use"

When you run `pnpm dev`, you get `Error: listen EADDRINUSE: address already in use :::3000`.

### Find the process using port 3000

```bash
# macOS / Linux
lsof -i :3000

# Or using fuser
fuser 3000/tcp
```

### Kill the process

```bash
# Replace <PID> with the process ID from lsof output
kill <PID>

# If the process won't die
kill -9 <PID>
```

### Use a different port

You can start the dev server on a different port. Set the `PORT` environment variable:

```bash
PORT=3001 pnpm dev
```

Or add to your `.env`:

```
PORT=3001
```

Remember to also update `NEXTAUTH_URL` to match:

```
NEXTAUTH_URL=http://localhost:3001
```

---

## "npm install fails" / "pnpm install fails"

### Node.js version mismatch

The project requires Node.js 20 or later. The Dockerfile (`Dockerfile`) uses `node:20-alpine`. Check your version:

```bash
node --version
```

If you are using an older version, upgrade using `nvm`:

```bash
nvm install 20
nvm use 20
```

### pnpm not installed

This project uses pnpm. Verify it is available:

```bash
pnpm --version
```

If not installed:

```bash
npm install -g pnpm
corepack enable
corepack prepare pnpm@latest --activate
```

### Corrupted lockfile or cache

If you see cryptic dependency resolution errors:

```bash
# Clear pnpm store
pnpm store prune

# Remove node_modules and reinstall
rm -rf node_modules
pnpm install --frozen-lockfile
```

### Prisma client generation fails during install

The `postinstall` script in `package.json` runs `prisma generate`. This requires a valid `prisma/schema.prisma`. If generation fails:

```bash
# Skip postinstall and generate manually
pnpm install --ignore-scripts
pnpm db:generate
```

---

## "Prisma client not generated"

You see errors like `Cannot find module '@/generated/prisma/client'` or `@prisma/client did not initialize yet`.

### Generate the client

```bash
pnpm db:generate
```

This reads `prisma/schema.prisma` and outputs the generated client to `src/generated/prisma/` (as configured in the schema's `generator` block).

### Verify the output

```bash
ls src/generated/prisma/client
```

You should see files including `index.js`, `index.d.ts`, and `schema.prisma`.

### Common causes

1. **Running `prisma generate` without the schema file present**: Ensure `prisma/schema.prisma` exists.
2. **Changed the output path in the generator block**: The `src/lib/db/client.ts` file imports from `@/generated/prisma/client`, so the generator output must match.
3. **Stale generated code after schema changes**: After modifying `prisma/schema.prisma`, always run `pnpm db:generate` to regenerate the client.

### After pulling new changes

If a teammate has modified the Prisma schema, you need to regenerate and apply migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

---

## "pgvector extension not available"

You see an error like `ERROR: function vector_cosine_ops does not exist` or the migration fails with `extension "vector" is not available`.

### PostgreSQL version too old

pgvector requires PostgreSQL 12 or later. The project's Docker setup uses `pgvector/pgvector:pg16` (PostgreSQL 16). Check your version:

```bash
psql -U postgres -c "SELECT version();"
```

### Extension not installed

For the Docker setup, the pgvector image includes the extension pre-installed. For other PostgreSQL instances:

```sql
-- Connect to your database and run:
CREATE EXTENSION IF NOT EXISTS vector;
```

You can do this via the Prisma migration system or directly:

```bash
npx prisma db execute --stdin <<< "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Using a managed database

Most cloud providers support pgvector:

- **Neon**: Enabled by default on new databases
- **Supabase**: Run `CREATE EXTENSION vector;` in the SQL editor
- **AWS RDS**: Enable `pgvector` in the parameter group, then create the extension
- **Google Cloud SQL**: Enable the `pgvector` extension via the flag `cloudsql.enable_pgvector`

### Verify the extension

```bash
psql -U postgres -d ragdb -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

If this returns a row, the extension is installed and active.

---

## Still having issues?

1. Check the full startup error message in your terminal. The `src/lib/env.ts` validator provides specific messages for each missing or invalid variable.
2. Ensure your `.env` file is in the project root (same directory as `package.json`).
3. Try a clean setup:

```bash
docker compose down -v    # Remove containers and data volumes
docker compose up -d      # Start fresh
rm -rf node_modules       # Clean dependencies
pnpm install              # Reinstall
pnpm db:generate          # Generate Prisma client
pnpm db:migrate           # Apply migrations
pnpm dev                  # Start the app
```

4. Open a GitHub issue with the full error output and your Node.js version (`node --version`).
