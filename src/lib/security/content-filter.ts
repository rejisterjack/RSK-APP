/**
 * Content Filter
 *
 * Filters LLM output for unsafe content before streaming to users.
 * Implements a sliding-window approach for streaming token buffers.
 */

import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface ContentFilterConfig {
  blockViolence: boolean;
  blockHateSpeech: boolean;
  blockPII: boolean;
  blockSystemLeakage: boolean;
  /** Number of tokens to buffer before checking in streaming mode */
  windowSize: number;
}

export interface ContentFilterResult {
  safe: boolean;
  filteredContent: string;
  violations: string[];
}

type FilterCategory = 'violence' | 'hate_speech' | 'pii' | 'system_leakage';

interface FilterRule {
  category: FilterCategory;
  pattern: RegExp;
  label: string;
}

// ============================================================================
// Filter Rules
// ============================================================================

const VIOLENCE_RULES: FilterRule[] = [
  {
    category: 'violence',
    pattern: /\bhow\s+to\s+(make|build|create)\s+(a\s+)?(bomb|weapon|explosive|poison)\b/gi,
    label: 'weapon_instructions',
  },
  {
    category: 'violence',
    pattern: /\bhow\s+to\s+(harm|hurt|kill|murder|attack)\b/gi,
    label: 'harm_instructions',
  },
  {
    category: 'violence',
    pattern: /\bstep[- ]by[- ]step\s+(bomb|weapon|attack|murder)\b/gi,
    label: 'step_by_step_violence',
  },
];

const HATE_SPEECH_RULES: FilterRule[] = [
  {
    category: 'hate_speech',
    pattern: /\b(all|every)\s+\w+\s+(should\s+be\s+)?(killed|dead|exterminated|eliminated)\b/gi,
    label: 'genocidal_language',
  },
  {
    category: 'hate_speech',
    pattern: /\b(inferior|subhuman|vermin|parasite)\s+race\b/gi,
    label: 'racial_slur',
  },
];

const PII_RULES: FilterRule[] = [
  { category: 'pii', pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, label: 'ssn_pattern' },
  { category: 'pii', pattern: /\b\d{16}\b/g, label: 'credit_card' },
  {
    category: 'pii',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    label: 'email_exposure',
  },
  {
    category: 'pii',
    pattern: /\b(?:password|secret|api[_-]?key|token)\s*[=:]\s*\S+/gi,
    label: 'credential_leak',
  },
];

const SYSTEM_LEAKAGE_RULES: FilterRule[] = [
  {
    category: 'system_leakage',
    pattern: /OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|DATABASE_URL|SECRET_KEY/gi,
    label: 'env_var_leak',
  },
  { category: 'system_leakage', pattern: /sk-[a-zA-Z0-9]{20,}/g, label: 'api_key_leak' },
  {
    category: 'system_leakage',
    pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g,
    label: 'private_key_leak',
  },
];

const DEFAULT_CONFIG: ContentFilterConfig = {
  blockViolence: true,
  blockHateSpeech: true,
  blockPII: true,
  blockSystemLeakage: true,
  windowSize: 10,
};

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Filter content string for unsafe material.
 * Returns filtered content with violations listed.
 */
export function filterContent(
  content: string,
  config: Partial<ContentFilterConfig> = {}
): ContentFilterResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const violations: string[] = [];
  let filtered = content;

  const activeRules: FilterRule[] = [
    ...(cfg.blockViolence ? VIOLENCE_RULES : []),
    ...(cfg.blockHateSpeech ? HATE_SPEECH_RULES : []),
    ...(cfg.blockPII ? PII_RULES : []),
    ...(cfg.blockSystemLeakage ? SYSTEM_LEAKAGE_RULES : []),
  ];

  for (const rule of activeRules) {
    if (rule.pattern.test(filtered)) {
      violations.push(rule.label);
      filtered = filtered.replace(rule.pattern, '[REDACTED]');
    }
  }

  return {
    safe: violations.length === 0,
    filteredContent: filtered,
    violations,
  };
}

/**
 * Streaming content filter that buffers tokens and checks at window boundaries.
 * Yields tokens only after they pass the safety check.
 */
export class StreamingContentFilter {
  private buffer: string[] = [];
  private config: ContentFilterConfig;
  private totalViolations: string[] = [];

  constructor(config: Partial<ContentFilterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process a token from the LLM stream.
   * Returns tokens that are safe to emit, or null if buffered.
   */
  processToken(token: string): string | null {
    this.buffer.push(token);

    // Only check when buffer reaches window size
    if (this.buffer.length < this.config.windowSize) {
      return null;
    }

    return this.flush();
  }

  /**
   * Flush any remaining buffered tokens.
   * Call this when the stream ends.
   */
  flush(): string {
    if (this.buffer.length === 0) return '';

    const content = this.buffer.join('');
    this.buffer = [];

    const result = filterContent(content, this.config);

    if (!result.safe) {
      this.totalViolations.push(...result.violations);
      logger.warn('Content filter triggered during streaming', {
        violations: result.violations,
      });
    }

    return result.filteredContent;
  }

  /**
   * Get all violations detected during the stream.
   */
  getViolations(): string[] {
    return [...this.totalViolations];
  }
}

/**
 * Quick check if content is safe without modifying it.
 * Useful for pre-filtering user input.
 */
export function isContentSafe(content: string): boolean {
  const result = filterContent(content);
  return result.safe;
}
