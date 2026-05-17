-- Performance indexes for peak query performance
-- Composite indexes + trigram text search

-- Composite index for chat list queries (userId + updatedAt ordering)
-- Prisma handles this via schema @@index, but add it explicitly for safety
CREATE INDEX CONCURRENTLY IF NOT EXISTS "chats_userId_updatedAt_idx" ON "chats"("userId", "updatedAt" DESC);

-- Composite index for document list queries (workspaceId + status + createdAt)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "documents_workspaceId_status_createdAt_idx" ON "documents"("workspaceId", "status", "createdAt" DESC);

-- Enable pg_trgm for fast ILIKE text search on message content
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN index for message content search
-- Supports fast ILIKE '%keyword%' and ILIKE 'keyword%' patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_content_trgm_idx" ON "messages" USING gin ("content" gin_trgm_ops);
