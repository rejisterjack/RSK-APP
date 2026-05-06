/**
 * Ingestion Error Categorization
 *
 * Maps error patterns from the document ingestion pipeline to structured
 * error categories with human-readable remediation messages.
 */

// Re-export the ErrorCategory values as a const object for runtime use,
// and derive the type from it so we stay in sync with the Prisma enum.
export const ErrorCategory = {
  PARSE_ERROR: 'PARSE_ERROR',
  EMBEDDING_ERROR: 'EMBEDDING_ERROR',
  SIZE_LIMIT: 'SIZE_LIMIT',
  OCR_FAILURE: 'OCR_FAILURE',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

// ---------------------------------------------------------------------------
// Remediation messages
// ---------------------------------------------------------------------------

export const ERROR_REMEDIATION: Record<ErrorCategory, string> = {
  PARSE_ERROR:
    'The file format may be corrupted or unsupported. Try re-uploading or converting to a different format.',
  EMBEDDING_ERROR:
    'The embedding provider is unavailable or your API key may be invalid. Check your EMBEDDING_PROVIDER and API key settings.',
  SIZE_LIMIT:
    'The file exceeds the maximum allowed size. Try splitting it into smaller documents.',
  OCR_FAILURE:
    'OCR processing failed. Ensure the document contains readable text.',
  PROVIDER_ERROR:
    'The AI provider returned an error. Check your API keys and provider status.',
  NETWORK_ERROR:
    'A network error occurred. Check your internet connection and try again.',
  UNKNOWN:
    'An unexpected error occurred. Try again or check the server logs.',
};

// ---------------------------------------------------------------------------
// Human-readable labels (for UI display)
// ---------------------------------------------------------------------------

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  PARSE_ERROR: 'Parse Error',
  EMBEDDING_ERROR: 'Embedding Error',
  SIZE_LIMIT: 'Size Limit',
  OCR_FAILURE: 'OCR Failure',
  PROVIDER_ERROR: 'Provider Error',
  NETWORK_ERROR: 'Network Error',
  UNKNOWN: 'Unknown Error',
};

// ---------------------------------------------------------------------------
// Error pattern matchers
// ---------------------------------------------------------------------------

interface ErrorPattern {
  test: (message: string) => boolean;
  category: ErrorCategory;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // PDF / document parse failures
  {
    test: (m) =>
      /failed to parse (?:pdf|docx|xlsx|pptx|html|document)/i.test(m) ||
      /pdf.*(pars|extract|read|invalid|corrupt)/i.test(m) ||
      /invalid pdf/i.test(m) ||
      /document has no content/i.test(m),
    category: ErrorCategory.PARSE_ERROR,
  },

  // Embedding API failures
  {
    test: (m) =>
      /failed to generate embeddings/i.test(m) ||
      /embedding.*(fail|error|unavailable)/i.test(m) ||
      /status\s*[:=]?\s*429/i.test(m) ||
      /status\s*[:=]?\s*401/i.test(m) ||
      /status\s*[:=]?\s*403/i.test(m) ||
      /rate limit.*embed/i.test(m) ||
      /quota.*exceeded/i.test(m) ||
      /api key.*invalid/i.test(m) ||
      /embed.*provider/i.test(m),
    category: ErrorCategory.EMBEDDING_ERROR,
  },

  // File too large
  {
    test: (m) =>
      /file.*(too large|exceeds|size limit|max.*size)/i.test(m) ||
      /document limit exceeded/i.test(m) ||
      /payload too large/i.test(m) ||
      /max.*file.*size/i.test(m),
    category: ErrorCategory.SIZE_LIMIT,
  },

  // OCR failures (Tesseract)
  {
    test: (m) =>
      /tesseract/i.test(m) ||
      /ocr.*(fail|error)/i.test(m) ||
      /failed.*ocr/i.test(m),
    category: ErrorCategory.OCR_FAILURE,
  },

  // LLM / OpenRouter provider errors
  {
    test: (m) =>
      /openrouter/i.test(m) ||
      /llm provider/i.test(m) ||
      /provider.*error/i.test(m) ||
      /ai provider/i.test(m) ||
      /model.*not found/i.test(m) ||
      /status\s*[:=]?\s*500.*provider/i.test(m),
    category: ErrorCategory.PROVIDER_ERROR,
  },

  // Network / timeout errors
  {
    test: (m) =>
      /timeout|timed out/i.test(m) ||
      /econnrefused|econnreset|enotfound/i.test(m) ||
      /fetch.*(fail|error)/i.test(m) ||
      /network.*(error|fail)/i.test(m) ||
      /socket hang up/i.test(m) ||
      /connection.*(refused|reset|closed)/i.test(m) ||
      /dns.*error/i.test(m),
    category: ErrorCategory.NETWORK_ERROR,
  },
];

// ---------------------------------------------------------------------------
// categorizeIngestionError
// ---------------------------------------------------------------------------

/**
 * Inspects an error (or error-like value) and returns the most appropriate
 * ErrorCategory based on the error message content.
 */
export function categorizeIngestionError(error: unknown): ErrorCategory {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (!message) {
    return ErrorCategory.UNKNOWN;
  }

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return pattern.category;
    }
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Returns the remediation message for a given error category.
 */
export function getRemediationMessage(category: ErrorCategory): string {
  return ERROR_REMEDIATION[category] ?? ERROR_REMEDIATION.UNKNOWN;
}

/**
 * Returns a human-readable label for a given error category.
 */
export function getCategoryLabel(category: ErrorCategory): string {
  return ERROR_CATEGORY_LABELS[category] ?? ERROR_CATEGORY_LABELS.UNKNOWN;
}
