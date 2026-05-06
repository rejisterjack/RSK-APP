# Troubleshooting Guides

This directory contains guides for diagnosing and fixing common issues with the RAG Starter Kit. Each guide covers a specific area with real commands, file paths, and configuration references from the project.

## Guides

### [Common Setup Issues](./common-setup-issues.md)
Database connection failures, missing environment variables, port conflicts, `npm install` failures, Prisma client generation, and pgvector extension problems. Start here if you are setting up the project for the first time.

### [Embedding Issues](./embedding-issues.md)
Dimension mismatch errors (768D vs 1536D), provider authentication failures, Ollama connectivity, re-embedding after model changes, and slow embedding performance.

### [Chat Issues](./chat-issues.md)
500 errors from the LLM provider, streaming failures, irrelevant responses, context window limits, and OpenRouter rate limiting (429 errors).

### [Document Ingestion](./document-ingestion.md)
Upload failures, ingestion stuck in "processing", OCR failures on scanned PDFs, parsing errors, and embedding failures during ingestion. Covers all error categories: `PARSE_ERROR`, `EMBEDDING_ERROR`, `SIZE_LIMIT`, `OCR_FAILURE`, `PROVIDER_ERROR`, `NETWORK_ERROR`.

### [Authentication Issues](./authentication-issues.md)
OAuth callback failures, session expiration, CSRF token mismatches, SAML SSO configuration, and API key authentication problems.

### [Deployment Issues](./deployment-issues.md)
Vercel build failures, production database connections, Redis configuration, middleware edge runtime errors, and Docker container startup problems.

### [Performance](./performance.md)
Slow vector search queries, high memory usage, slow page loads, and database bloat. Includes index tuning (HNSW vs IVFFlat), bundle analysis, and partition management.

## Quick Reference

### Environment Variables Checklist

The following variables are **required** (validated at startup in `src/lib/env.ts`):

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Must be at least 32 characters |
| `NEXTAUTH_URL` | Base URL of your application |
| `OPENROUTER_API_KEY` | API key for LLM access |

Additional variables are required in production or conditionally for specific features. See `src/lib/env.ts` for the full schema.

### Useful Commands

```bash
# Check database connection
npx prisma db execute --stdin <<< "SELECT 1;"

# Regenerate Prisma client
pnpm db:generate

# Run pending migrations
pnpm db:migrate

# Start local services (PostgreSQL + Redis)
docker compose up -d

# View application logs in development
pnpm dev
```

### Getting Help

- **GitHub Issues**: [Report a bug](https://github.com/your-org/rag-starter-kit/issues)
- **GitHub Discussions**: [Ask a question](https://github.com/your-org/rag-starter-kit/discussions)
- **Documentation**: See the `docs/` directory for architecture, API, and security documentation
