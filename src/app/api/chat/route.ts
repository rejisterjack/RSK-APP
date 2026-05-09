/**
 * Chat API Route with Streaming Support
 * Handles chat messages with RAG context and streaming responses
 *
 * Security Features:
 * - Authentication check
 * - Workspace access validation
 * - Rate limiting
 * - Input validation
 * - Audit logging
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, type LanguageModel, streamText } from 'ai';
import { NextResponse } from 'next/server';
import type { LLMMessage } from '@/lib/ai/llm';
import { modelHealthCache } from '@/lib/ai/model-health-cache';
import { buildSystemPromptWithContext } from '@/lib/ai/prompts/templates';
import { bufferUsageRecord } from '@/lib/analytics/usage-buffer';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  ConcurrentModificationError,
  extractVersion,
  updateWithVersion,
} from '@/lib/db/optimistic-locking';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  chatCreateSchema,
  chatUpdateSchema,
  validateChatInput,
} from '@/lib/security/input-validator';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// Lazy-loaded modules to reduce cold-start time.
// These are heavy and only needed inside the handler body.
async function citations() {
  return await import('@/lib/rag/citations');
}
async function memory() {
  return await import('@/lib/rag/memory');
}
async function retrieval() {
  return await import('@/lib/rag/retrieval');
}
async function tokenBudget() {
  return await import('@/lib/rag/token-budget');
}
async function degradation() {
  return await import('@/lib/resilience/degradation');
}
async function externalServices() {
  return await import('@/lib/resilience/external-services');
}
async function tracing() {
  return await import('@/lib/tracing');
}

// =============================================================================
// Route Configuration
// =============================================================================

// Vercel maxDuration: streaming chat can run up to 120s
export const maxDuration = 120;

// =============================================================================
// Configuration
// =============================================================================

/** Timeout for AI calls — allows complex RAG responses while preventing hung connections */
const AI_CALL_TIMEOUT_MS = 60_000;
/** Shorter timeout for model health probes (just checking liveness) */
const PROBE_TIMEOUT_MS = 3_000;

const defaultConfig = {
  model: process.env.DEFAULT_MODEL || 'groq/llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  chunkSize: 1000,
  chunkOverlap: 200,
  maxMessages: 10,
  hybridSearchEnabled: true,
  rerankingEnabled: true,
  topK: 5,
  similarityThreshold: 0.7,
};

/**
 * Best OpenRouter free models - tried in order if primary fails
 * IMPLEMENTED: Fallback logic tries each model in order until one succeeds
 */
const MODEL_FALLBACK_CHAIN = [
  'groq/llama-3.3-70b-versatile',
  'minimax/minimax-m2.5:free',
  'google/gemma-4-26b-a4b-it:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'openai/gpt-oss-20b:free',
];

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(req: Request) {
  const startTime = Date.now();

  // Cold-start monitoring: track time from module load to first response
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.setTag('route', '/api/chat');
      Sentry.setTag('method', 'POST');
    } catch {
      // Sentry not available
    }
  }

  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'chat', {
      userId,
      workspaceId,
      endpoint: '/api/chat',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded',
            resetAt: new Date(rateLimitResult.reset).toISOString(),
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Step 2b: Check if LLM generation is degraded
    const { isFeatureDegraded } = await degradation();
    if (await isFeatureDegraded('llm_generation')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_DEGRADED',
            message: 'AI service temporarily unavailable. Please try again shortly.',
          },
        },
        { status: 503, headers: { 'X-Degraded-Features': 'llm_generation' } }
      );
    }

    // Step 3: Validate workspace access
    if (workspaceId) {
      const hasAccess = await checkPermission(userId, workspaceId, Permission.READ_DOCUMENTS);
      if (!hasAccess) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId,
          metadata: {
            action: 'chat',
            requiredPermission: Permission.READ_DOCUMENTS,
          },
          severity: 'WARNING',
        });

        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } },
          { status: 403 }
        );
      }
    }

    // Step 4: Parse and validate request body

    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in chat request', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    // Step 5: Validate input
    let validatedInput: ReturnType<typeof validateChatInput>;
    try {
      validatedInput = validateChatInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: error.message,
            },
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const {
      messages,
      chatId,
      conversationId,
      config: userConfig,
      stream: shouldStream,
    } = validatedInput;
    const config = { ...defaultConfig, ...userConfig };
    const effectiveConversationId = conversationId ?? chatId;
    const userMessage = messages[messages.length - 1].content;

    // Step 6: Get conversation history
    const { ConversationMemory } = await memory();
    const conversationMemory = new ConversationMemory(prisma);
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (effectiveConversationId) {
      // Verify user has access to this conversation
      const chat = await prisma.chat.findFirst({
        where: {
          id: effectiveConversationId,
          OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
        },
      });

      if (!chat) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } },
          { status: 404 }
        );
      }

      const recentMessages = await conversationMemory.getRecentMessages(
        effectiveConversationId,
        10
      );
      history = recentMessages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
    }

    // Step 7: Retrieve relevant sources (graceful fallback if embedding/vector search fails)
    let sources: Awaited<ReturnType<typeof import('@/lib/rag/retrieval')['retrieveSources']>> = [];
    let vectorSearchDegraded = false;
    try {
      const { isFeatureDegraded: checkDegraded } = await degradation();
      if (await checkDegraded('vector_search')) {
        vectorSearchDegraded = true;
        logger.info('Vector search degraded, skipping RAG retrieval');
      } else {
        const { retrieveSources } = await retrieval();
        const { withSpan } = await tracing();
        sources = await withSpan('chat.retrieve_sources', async (span) => {
          span.setAttribute('chat.query_length', userMessage.length);
          const result = await retrieveSources(userMessage, userId, config);
          span.setAttribute('chat.sources_count', result.length);
          return result;
        });
      }
    } catch (err) {
      logger.warn('Source retrieval failed, continuing without RAG context', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Step 8: Build context with citations
    const { CitationHandler, sourcesToChunks } = await citations();
    const citationHandler = new CitationHandler();
    const chunks = sourcesToChunks(sources);
    const { context, citationMap } = citationHandler.formatContextWithCitations(chunks);

    // Step 9: Build system prompt
    const systemPrompt = buildSystemPromptWithContext(context, {
      style: config.temperature < 0.5 ? 'concise' : 'balanced',
    });

    // Step 10: Prepare messages for LLM
    const llmMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    // Step 10b: Estimate token usage for budget tracking
    const { estimateMessageTokens } = await tokenBudget();
    const estimatedTokens = estimateMessageTokens(llmMessages);
    if (estimatedTokens > config.maxTokens * 2) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_LIMIT',
            message: 'Message too long',
            details: `Estimated tokens (${estimatedTokens}) exceeds limit (${config.maxTokens * 2})`,
          },
        },
        { status: 400 }
      );
    }

    // Step 11: Save user message to database
    if (effectiveConversationId) {
      await conversationMemory.addMessage(effectiveConversationId, {
        role: 'user',
        content: userMessage,
      });
    }

    // Step 12: Log chat message
    await logAuditEvent({
      event: AuditEvent.CHAT_MESSAGE_SENT,
      userId,
      workspaceId,
      metadata: {
        chatId: effectiveConversationId,
        messageLength: userMessage.length,
        hasContext: sources.length > 0,
        sourceCount: sources.length,
        model: config.model,
      },
    });

    if (shouldStream) {
      // Streaming response — use health cache to avoid expensive probes
      const allModels = [config.model, ...MODEL_FALLBACK_CHAIN.filter((m) => m !== config.model)];

      // If the circuit breaker is open, fail fast
      const { llmCircuitBreaker } = await externalServices();
      if (llmCircuitBreaker.getState() === 'OPEN') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MODEL_UNAVAILABLE',
              message: 'AI service temporarily unavailable. Please try again in a moment.',
            },
          },
          { status: 503 }
        );
      }

      // Filter models based on health cache (skip models in backoff)
      const modelsToTry = modelHealthCache.getModelsToTry(allModels);

      if (modelsToTry.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MODEL_UNAVAILABLE',
              message: 'All AI models are currently unavailable. Please try again in a moment.',
            },
          },
          { status: 503 }
        );
      }

      let usedModel = modelsToTry[0];
      let probeOk = false;

      // If the primary model was recently confirmed healthy, skip probing entirely
      if (modelHealthCache.isRecentlyHealthy(modelsToTry[0])) {
        usedModel = modelsToTry[0];
        probeOk = true;
        logger.debug('Skipping probe — model recently healthy', { model: usedModel });
      } else {
        // Only probe when model health is unknown or expired
        for (const modelName of modelsToTry) {
          const probeStart = Date.now();
          try {
            await llmCircuitBreaker.execute(async () => {
              await generateText({
                model: getModel(modelName),
                messages: [{ role: 'user', content: userMessage.slice(0, 100) }],
                maxTokens: 1,
                abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
              });
            });
            usedModel = modelName;
            probeOk = true;
            modelHealthCache.recordSuccess(modelName);
            logger.debug('Model probe succeeded', {
              model: modelName,
              durationMs: Date.now() - probeStart,
            });
            break;
          } catch (err) {
            modelHealthCache.recordFailure(modelName);
            logger.warn(`Model ${modelName} probe failed, trying next`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      if (!probeOk) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MODEL_UNAVAILABLE',
              message: 'All AI models are currently unavailable. Please try again in a moment.',
            },
          },
          { status: 503 }
        );
      }

      const result = streamText({
        model: getModel(usedModel),
        messages: llmMessages,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        abortSignal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
        onFinish: async (completion) => {
          try {
            if (effectiveConversationId) {
              await prisma.message.create({
                data: {
                  chatId: effectiveConversationId,
                  content: completion.text,
                  role: 'ASSISTANT',
                },
              });
            }

            if (completion.usage) {
              bufferUsageRecord({
                userId,
                workspaceId,
                endpoint: '/api/chat',
                method: 'POST',
                tokensPrompt: completion.usage.promptTokens ?? 0,
                tokensCompletion: completion.usage.completionTokens ?? 0,
                tokensTotal:
                  (completion.usage.promptTokens ?? 0) + (completion.usage.completionTokens ?? 0),
                latencyMs: Date.now() - startTime,
              });
            }

            // Title generation is non-critical — run outside transaction
            if (effectiveConversationId) {
              await maybeGenerateTitle(
                effectiveConversationId,
                userMessage,
                completion.text,
                usedModel
              );
            }
          } catch (txError) {
            logger.warn('Transaction failed in streaming onFinish', {
              error: txError instanceof Error ? txError.message : String(txError),
            });
          }
        },
      });

      // Prepare source metadata for headers
      const sourcesMetadata = sources.map((s) => ({
        id: s.id,
        documentName: s.metadata.documentName,
        documentId: s.metadata.documentId,
        page: s.metadata.page,
        similarity: s.similarity,
      }));

      const response = result.toTextStreamResponse({
        headers: {
          'X-Message-Sources': JSON.stringify(sourcesMetadata),
          'X-Model-Used': usedModel,
          ...(vectorSearchDegraded ? { 'X-Degraded-Features': 'vector_search' } : {}),
        },
      });

      // Add rate limit headers
      addRateLimitHeaders(response.headers, rateLimitResult);

      return response;
    } else {
      // Non-streaming response with model fallback
      const response = await generateWithFallback(llmMessages, {
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        primaryModel: config.model,
      });

      // Extract citations
      const citations = citationHandler.extractCitations(response.text, citationMap);

      // Save assistant response
      if (effectiveConversationId) {
        await prisma.message.create({
          data: {
            chatId: effectiveConversationId,
            content: response.text,
            role: 'ASSISTANT',
            sources: citations.map((c) => ({
              id: c.chunkId,
              content: c.content,
              similarity: c.score,
              metadata: {
                documentId: c.documentId,
                documentName: c.documentName,
                page: c.page,
                chunkIndex: 0,
                totalChunks: 0,
              },
            })),
            tokensUsed: {
              prompt: response.usage?.promptTokens ?? 0,
              completion: response.usage?.completionTokens ?? 0,
              total: response.usage?.totalTokens ?? 0,
            },
          },
        });
      }

      // Buffer usage record (batched write)
      bufferUsageRecord({
        userId,
        workspaceId,
        endpoint: '/api/chat',
        method: 'POST',
        tokensPrompt: response.usage?.promptTokens ?? 0,
        tokensCompletion: response.usage?.completionTokens ?? 0,
        tokensTotal: response.usage?.totalTokens ?? 0,
        latencyMs: Date.now() - startTime,
      });

      // Title generation is non-critical — run outside transaction
      if (effectiveConversationId) {
        await maybeGenerateTitle(
          effectiveConversationId,
          userMessage,
          response.text,
          response.model
        );
      }

      const jsonResponse = NextResponse.json({
        success: true,
        data: {
          content: response.text,
          sources: citations.map((c) => ({
            id: c.id,
            documentName: c.documentName,
            documentId: c.documentId,
            page: c.page,
            score: c.score,
          })),
          usage: response.usage,
          model: response.model,
        },
      });

      // Add rate limit headers
      addRateLimitHeaders(jsonResponse.headers, rateLimitResult);

      return jsonResponse;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    const statusCode = isTimeout
      ? 503
      : error instanceof Error && 'code' in error
        ? getErrorStatusCode((error as { code: string }).code)
        : 500;

    // Only expose error details in development to prevent information leakage
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
          message: isTimeout
            ? 'The AI service took too long to respond. Please try again.'
            : 'Failed to process chat request',
          ...(isDev && { details: errorMessage }),
        },
      },
      { status: statusCode }
    );
  }
}

// =============================================================================
// PUT Handler - Create a new chat
// =============================================================================

export async function PUT(req: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Your session is out of date. Please sign in again.',
          },
        },
        { status: 401 }
      );
    }

    // JWT can retain a workspaceId after DB reset or workspace deletion; Prisma would
    // reject the FK on chat create. Only attach workspace the user still belongs to.
    let resolvedWorkspaceId: string | null = null;
    if (workspaceId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, workspaceId },
        select: { workspaceId: true },
      });
      resolvedWorkspaceId = membership?.workspaceId ?? null;
    }

    // Check rate limit for chat creation
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'chat', {
      userId,
      workspaceId,
      endpoint: '/api/chat',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded',
            resetAt: new Date(rateLimitResult.reset).toISOString(),
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in chat title generation', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const parsed = chatCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }
    const { title, model } = parsed.data;

    // Create chat
    const chat = await prisma.chat.create({
      data: {
        title: title || 'New Chat',
        model: model || defaultConfig.model,
        userId,
        workspaceId: resolvedWorkspaceId,
      },
    });

    // Log creation
    await logAuditEvent({
      event: AuditEvent.CHAT_CREATED,
      userId,
      workspaceId: resolvedWorkspaceId ?? undefined,
      metadata: { chatId: chat.id, title: chat.title },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        chat: {
          id: chat.id,
          title: chat.title,
          model: chat.model,
          createdAt: chat.createdAt.toISOString(),
        },
      },
    });

    // Add rate limit headers
    addRateLimitHeaders(response.headers, rateLimitResult);

    return response;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to create chat', {
      error: errMsg,
    });
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create chat',
          ...(isDev && { details: errMsg }),
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET Handler - Get chat history
// =============================================================================

export async function GET(req: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    const conversationId = searchParams.get('conversationId');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 100);

    const effectiveId = chatId ?? conversationId;

    if (!effectiveId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_ID', message: 'chatId or conversationId is required' },
        },
        { status: 400 }
      );
    }

    // Verify user has access to this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: effectiveId,
        OR: [{ userId }, { workspaceId: session.user.workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } },
        { status: 404 }
      );
    }

    const { ConversationMemory: ConvMem } = await memory();
    const convMemory = new ConvMem(prisma);
    const messages = await convMemory.getHistory(effectiveId, limit);

    return NextResponse.json({
      success: true,
      data: {
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          sources: m.sources,
        })),
        count: messages.length,
      },
    });
  } catch (error) {
    logger.warn('Failed to retrieve chat history', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve chat history' },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE Handler - Delete chat
// =============================================================================

export async function DELETE(req: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'chatId is required' } },
        { status: 400 }
      );
    }

    // Verify user has access to delete this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId }, workspaceId ? { workspaceId } : {}],
      },
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } },
        { status: 404 }
      );
    }

    // Check delete permission for workspace chats
    if (chat.workspaceId && chat.userId !== userId) {
      const canDelete = await checkPermission(userId, chat.workspaceId, Permission.DELETE_CHATS);
      if (!canDelete) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 }
        );
      }
    }

    // Delete chat (cascade will handle messages)
    await prisma.chat.delete({
      where: { id: chatId },
    });

    // Log deletion
    await logAuditEvent({
      event: AuditEvent.CHAT_DELETED,
      userId,
      workspaceId: chat.workspaceId ?? undefined,
      metadata: { chatId },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Chat deleted successfully' },
    });
  } catch (error) {
    logger.warn('Failed to delete chat', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete chat' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH Handler - Update chat (title, model, etc.)
// =============================================================================

export async function PATCH(req: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in chat update', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const parsed = chatUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }
    const { chatId, title, model } = parsed.data;

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'chatId is required' } },
        { status: 400 }
      );
    }

    // Verify user has access to this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId }, workspaceId ? { workspaceId } : {}],
      },
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: { title?: string; model?: string } = {};
    if (title !== undefined) updateData.title = title;
    if (model !== undefined) updateData.model = model;

    // Update chat (with optimistic locking if If-Match provided)
    let updatedChat: Record<string, unknown>;
    const expectedVersion = extractVersion(req.headers);
    try {
      if (expectedVersion !== null) {
        updatedChat = await updateWithVersion('chat', chatId, updateData, expectedVersion);
      } else {
        updatedChat = await prisma.chat.update({
          where: { id: chatId },
          data: updateData,
        });
      }
    } catch (e) {
      if (e instanceof ConcurrentModificationError) {
        return NextResponse.json(
          { success: false, error: { code: 'CONFLICT', message: e.message } },
          { status: 409 }
        );
      }
      throw e;
    }

    // Log update
    // FIXED: Use correct audit event for chat updates
    await logAuditEvent({
      event: AuditEvent.CHAT_UPDATED,
      userId,
      workspaceId: chat.workspaceId ?? undefined,
      metadata: { chatId, updates: Object.keys(updateData) },
    });

    const chatResult = updatedChat as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      data: {
        chat: {
          id: chatResult.id,
          title: chatResult.title,
          model: chatResult.model,
          version: chatResult.version,
          updatedAt: (chatResult.updatedAt as Date).toISOString(),
        },
      },
    });
  } catch (error) {
    logger.warn('Failed to update chat', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update chat' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the appropriate model based on model name using server-side env vars
 */
function getModel(modelName: string): LanguageModel {
  // Groq models (prefix: "groq/")
  if (modelName.startsWith('groq/')) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error('Groq API key required. Set GROQ_API_KEY environment variable.');
    }
    const groq = createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: groqKey,
    });
    return groq(modelName.slice(5)) as unknown as LanguageModel;
  }

  // NVIDIA NIM models (prefix: "nvidia-nim/")
  if (modelName.startsWith('nvidia-nim/')) {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (!nvidiaKey) {
      throw new Error('NVIDIA API key required. Set NVIDIA_API_KEY environment variable.');
    }
    const nvidia = createOpenAI({
      baseURL: 'https://integrate.api.nvidia.com/v1',
      apiKey: nvidiaKey,
    });
    return nvidia(modelName.slice(11)) as unknown as LanguageModel;
  }

  // Cerebras models (prefix: "cerebras/")
  if (modelName.startsWith('cerebras/')) {
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    if (!cerebrasKey) {
      throw new Error('Cerebras API key required. Set CEREBRAS_API_KEY environment variable.');
    }
    const cerebras = createOpenAI({
      baseURL: 'https://api.cerebras.ai/v1',
      apiKey: cerebrasKey,
    });
    return cerebras(modelName.slice(9)) as unknown as LanguageModel;
  }

  // SambaNova models (prefix: "sambanova/")
  if (modelName.startsWith('sambanova/')) {
    const sambanovaKey = process.env.SAMBANOVA_API_KEY;
    if (!sambanovaKey) {
      throw new Error('SambaNova API key required. Set SAMBANOVA_API_KEY environment variable.');
    }
    const sambanova = createOpenAI({
      baseURL: 'https://api.sambanova.ai/v1',
      apiKey: sambanovaKey,
    });
    return sambanova(modelName.slice(10)) as unknown as LanguageModel;
  }

  // Mistral models (prefix: "mistral/")
  if (modelName.startsWith('mistral/')) {
    const mistralKey = process.env.MISTRAL_API_KEY;
    if (!mistralKey) {
      throw new Error('Mistral API key required. Set MISTRAL_API_KEY environment variable.');
    }
    const mistral = createOpenAI({
      baseURL: 'https://api.mistral.ai/v1',
      apiKey: mistralKey,
    });
    return mistral(modelName.slice(8)) as unknown as LanguageModel;
  }

  // Fireworks AI models (prefixed with "accounts/fireworks/")
  if (modelName.startsWith('accounts/fireworks/')) {
    const fireworksKey = env.FIREWORKS_API_KEY;
    if (!fireworksKey) {
      throw new Error('Fireworks API key required. Set FIREWORKS_API_KEY environment variable.');
    }
    const fireworks = createOpenAI({
      baseURL: 'https://api.fireworks.ai/inference/v1',
      apiKey: fireworksKey,
    });
    return fireworks(modelName) as unknown as LanguageModel;
  }

  // OpenRouter models (contains '/' or ends with ':free') - default
  const openrouterKey = env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    const openrouter = createOpenRouter({ apiKey: openrouterKey });
    return openrouter.chat(modelName) as unknown as LanguageModel;
  }

  throw new Error(`No API key available for model: ${modelName}`);
}

/**
 * Try to generate text with fallback models
 * Attempts each model in the fallback chain until one succeeds
 */
async function generateWithFallback(
  messages: LLMMessage[],
  options: {
    temperature: number;
    maxTokens: number;
    primaryModel: string;
  }
): Promise<{
  text: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const modelsToTry = [
    options.primaryModel,
    ...MODEL_FALLBACK_CHAIN.filter((m) => m !== options.primaryModel),
  ];

  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      const { llmCircuitBreaker: breaker } = await externalServices();
      const result = await breaker.execute(async () =>
        generateText({
          model: getModel(modelName),
          messages,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          abortSignal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
        })
      );

      // Return successful result with the model that worked
      return {
        text: result.text,
        model: modelName,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens ?? 0,
              completionTokens: result.usage.completionTokens ?? 0,
              totalTokens: (result.usage.promptTokens ?? 0) + (result.usage.completionTokens ?? 0),
            }
          : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Model ${modelName} failed, trying fallback`, {
        error: lastError.message,
      });
      // Continue to next model in chain
    }
  }

  // All models failed
  throw lastError || new Error('All models in fallback chain failed');
}

/**
 * Map error codes to HTTP status codes
 */
function getErrorStatusCode(code: string): number {
  const statusMap: Record<string, number> = {
    RATE_LIMIT: 429,
    MODEL_UNAVAILABLE: 503,
    CONTEXT_LENGTH_EXCEEDED: 413,
    UNAUTHORIZED: 401,
    CONFIG_ERROR: 500,
    UNKNOWN_PROVIDER: 400,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
  };

  return statusMap[code] ?? 500;
}

/**
 * Generate a title for the chat based on the first user message and assistant response
 * Only generates if the chat still has the default title
 */
async function maybeGenerateTitle(
  chatId: string,
  userMessage: string,
  assistantResponse: string,
  modelName: string
): Promise<void> {
  try {
    // Check if chat has default title
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { title: true },
    });

    if (!chat || (chat.title !== 'New Chat' && chat.title !== '')) {
      return; // Already has a custom title
    }

    // Generate title using a quick LLM call
    const titleModel = modelName.includes(':') ? 'mistralai/mistral-7b-instruct:free' : modelName;

    const { text: title } = await generateText({
      model: getModel(titleModel),
      messages: [
        {
          role: 'system',
          content:
            'Generate a concise 4-6 word title for this conversation. Return ONLY the title, no quotes or explanation.',
        },
        {
          role: 'user',
          content: `User: ${userMessage.slice(0, 200)}\n\nAssistant: ${assistantResponse.slice(0, 200)}`,
        },
      ],
      maxTokens: 20,
      temperature: 0.7,
      abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    const cleanTitle = title
      .trim()
      .replace(/^["']|["']$/g, '')
      .slice(0, 100);

    if (cleanTitle && cleanTitle.length > 0) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { title: cleanTitle },
      });

      logger.info('Generated chat title', { chatId, title: cleanTitle });
    }
  } catch (error) {
    // Don't fail the chat if title generation fails
    logger.warn('Failed to generate chat title', {
      chatId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
