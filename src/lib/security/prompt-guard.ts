/**
 * Prompt Injection Guard
 *
 * Detects and mitigates prompt injection attacks before they reach the LLM.
 * Uses pattern-based detection, heuristic scoring, and output filtering.
 */

import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export type ThreatLevel = 'safe' | 'suspicious' | 'malicious';

export interface PromptGuardResult {
  threatLevel: ThreatLevel;
  score: number;
  blocked: boolean;
  reasons: string[];
  sanitizedQuery?: string;
}

interface InjectionPattern {
  pattern: RegExp;
  name: string;
  severity: number;
}

// ============================================================================
// Injection Patterns
// ============================================================================

const INJECTION_PATTERNS: InjectionPattern[] = [
  // Direct instruction overrides
  {
    pattern: /ignore\s+(all\s+)?previous\s+(instructions|prompts|rules)/i,
    name: 'ignore_previous',
    severity: 0.9,
  },
  { pattern: /disregard\s+(all\s+)?previous/i, name: 'disregard_previous', severity: 0.9 },
  {
    pattern: /forget\s+(all\s+)?(your|previous|the)\s+(instructions|rules|prompt)/i,
    name: 'forget_instructions',
    severity: 0.85,
  },
  { pattern: /you\s+are\s+now\s+a/i, name: 'role_override', severity: 0.8 },
  { pattern: /new\s+instructions?\s*:/i, name: 'new_instructions', severity: 0.8 },
  { pattern: /system\s*:\s*/i, name: 'system_prefix', severity: 0.85 },
  { pattern: /\[system\]/i, name: 'system_tag', severity: 0.8 },

  // Context manipulation
  {
    pattern: /above\s+context\s+is\s+(now|actually)\s+/i,
    name: 'context_manipulation',
    severity: 0.75,
  },
  {
    pattern: /the\s+(real|actual|true)\s+(task|instruction|prompt)\s+is/i,
    name: 'task_redirection',
    severity: 0.8,
  },
  { pattern: /pretend\s+(you\s+are|to\s+be)\s+a/i, name: 'pretend_role', severity: 0.7 },

  // Output manipulation
  {
    pattern: /output\s+the\s+(full|entire|complete)\s+(system|prompt|instructions)/i,
    name: 'prompt_extraction',
    severity: 0.85,
  },
  {
    pattern: /reveal\s+(your|the)\s+(system|original|initial)\s+(prompt|instructions)/i,
    name: 'prompt_extraction_2',
    severity: 0.85,
  },
  {
    pattern: /what\s+(were|are)\s+your\s+(original|initial|system)\s+(instructions|prompt)/i,
    name: 'prompt_extraction_3',
    severity: 0.75,
  },
  {
    pattern:
      /repeat\s+(the|your|all)\s+(system|initial|original|previous)\s*(prompt|instructions|rules)/i,
    name: 'prompt_repeat',
    severity: 0.8,
  },

  // Injection via structured formats
  { pattern: /```system\n/i, name: 'code_block_system', severity: 0.85 },
  { pattern: /<\|im_start\|>/i, name: 'chatml_injection', severity: 0.9 },
  { pattern: /<\|endoftext\|>/i, name: 'endoftext_injection', severity: 0.85 },

  // Chained/recursive attacks
  {
    pattern: /translate\s+.*\s+to\s+.*\s+(then|and)\s+(execute|run|output|print)/i,
    name: 'chained_attack',
    severity: 0.7,
  },
];

const HEURISTIC_THRESHOLDS = {
  maxQueryLength: 4000,
  maxInstructionDensity: 0.15,
  maxNewlines: 20,
  suspiciousKeywords: ['jailbreak', 'bypass', 'hack', 'exploit', 'inject', 'malicious', 'payload'],
} as const;

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Check query against known injection patterns
 */
function matchPatterns(query: string): { matches: InjectionPattern[]; maxSeverity: number } {
  const matches: InjectionPattern[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.pattern.test(query)) {
      matches.push(pattern);
    }
  }

  const maxSeverity = matches.length > 0 ? Math.max(...matches.map((m) => m.severity)) : 0;
  return { matches, maxSeverity };
}

/**
 * Heuristic analysis of query characteristics
 */
function analyzeHeuristics(query: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Abnormally long queries often contain hidden instructions
  if (query.length > HEURISTIC_THRESHOLDS.maxQueryLength) {
    score += 0.2;
    reasons.push('Query exceeds maximum expected length');
  }

  // High density of instruction-like words
  const instructionWords = query.match(
    /\b(ignore|disregard|forget|pretend|act|assume|output|reveal|show|print|execute|system|instructions?|prompt|rules?)\b/gi
  );
  const density = instructionWords ? instructionWords.length / query.split(/\s+/).length : 0;
  if (density > HEURISTIC_THRESHOLDS.maxInstructionDensity) {
    score += 0.25;
    reasons.push('High density of instruction-like language');
  }

  // Excessive newlines can indicate hidden payload separation
  const newlineCount = (query.match(/\n/g) || []).length;
  if (newlineCount > HEURISTIC_THRESHOLDS.maxNewlines) {
    score += 0.15;
    reasons.push('Excessive line breaks detected');
  }

  // Direct suspicious keyword mentions
  const suspiciousFound = HEURISTIC_THRESHOLDS.suspiciousKeywords.filter((kw) =>
    query.toLowerCase().includes(kw)
  );
  if (suspiciousFound.length > 0) {
    score += 0.2 * suspiciousFound.length;
    reasons.push(`Suspicious keywords detected: ${suspiciousFound.join(', ')}`);
  }

  // Multiple role-switching attempts
  const roleSwitches = query.match(/\b(you are|you're|your role|as a|act as)\b/gi);
  if (roleSwitches && roleSwitches.length > 2) {
    score += 0.2;
    reasons.push('Multiple role-switching attempts');
  }

  return { score: Math.min(score, 1), reasons };
}

/**
 * Sanitize a query by removing or neutralizing injection attempts
 */
function sanitizeQuery(query: string): string {
  let sanitized = query;

  // Remove known injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern.pattern, '[removed]');
  }

  // Collapse excessive whitespace
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  return sanitized.trim();
}

// ============================================================================
// Main Guard Function
// ============================================================================

/**
 * Analyze a user query for prompt injection attempts.
 *
 * Returns a threat assessment with a score from 0 (safe) to 1 (malicious).
 * Queries scoring above 0.5 are blocked, between 0.3 and 0.5 are flagged suspicious.
 */
export function analyzePromptSafety(query: string): PromptGuardResult {
  if (!query || typeof query !== 'string') {
    return { threatLevel: 'safe', score: 0, blocked: false, reasons: [] };
  }

  const reasons: string[] = [];
  let totalScore = 0;

  // Pattern-based detection
  const { matches, maxSeverity } = matchPatterns(query);
  if (matches.length > 0) {
    totalScore += maxSeverity;
    reasons.push(...matches.map((m) => `Pattern matched: ${m.name}`));
  }

  // Heuristic analysis
  const heuristics = analyzeHeuristics(query);
  if (heuristics.score > 0) {
    totalScore = Math.min(totalScore + heuristics.score, 1);
    reasons.push(...heuristics.reasons);
  }

  // Determine threat level
  const threatLevel: ThreatLevel =
    totalScore >= 0.5 ? 'malicious' : totalScore >= 0.3 ? 'suspicious' : 'safe';

  const blocked = totalScore >= 0.5;

  if (blocked) {
    logger.warn('Prompt injection blocked', {
      score: totalScore,
      reasons,
      queryLength: query.length,
    });
  } else if (threatLevel === 'suspicious') {
    logger.info('Suspicious query detected', {
      score: totalScore,
      reasons,
      queryLength: query.length,
    });
  }

  return {
    threatLevel,
    score: Math.round(totalScore * 100) / 100,
    blocked,
    reasons,
    sanitizedQuery: blocked ? undefined : sanitizeQuery(query),
  };
}

/**
 * Filter LLM output for leaked system prompts or sensitive content.
 * Returns the filtered output and whether any content was removed.
 */
export function filterOutput(output: string): { filtered: string; hadLeak: boolean } {
  if (!output || typeof output !== 'string') {
    return { filtered: output, hadLeak: false };
  }

  let filtered = output;
  let hadLeak = false;

  // Strip leaked system prompt fragments
  const systemPatterns = [
    /You are a helpful AI assistant\.\s*Answer the user's question based on the provided context\./gi,
    /Context:\n[\s\S]*?(?=\n\nInstructions:|\n\nHuman:|$)/gi,
    /Instructions:\n- Answer based only on the context/gi,
    /Cite sources using \[\d+\]/gi,
  ];

  for (const pattern of systemPatterns) {
    if (pattern.test(filtered)) {
      hadLeak = true;
      filtered = filtered.replace(pattern, '[content removed]');
    }
  }

  return { filtered, hadLeak };
}
