/**
 * Input Validation Utilities
 *
 * Provides validation functions for emails, URLs, file types,
 * file sizes, API keys, and input sanitization.
 */

// =============================================================================
// Email Validation
// =============================================================================

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;

  // Basic structure check
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 1) return false;

  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex + 1);

  // Local part must not be empty
  if (localPart.length === 0) return false;

  // Domain must have at least one dot and characters after it
  if (!domain.includes('.')) return false;

  // Domain parts must not be empty
  const domainParts = domain.split('.');
  if (domainParts.some((part) => part.length === 0)) return false;

  // No consecutive dots in local part
  if (localPart.includes('..')) return false;

  // Domain parts must not have consecutive dots (already handled above)
  // Basic character validation
  if (/[^a-zA-Z0-9._%+-]/.test(localPart)) return false;
  if (/[^a-zA-Z0-9.-]/.test(domain)) return false;

  return true;
}

// =============================================================================
// URL Validation
// =============================================================================

/**
 * Validate URL format and optionally check allowed protocols
 */
export function validateUrl(url: string, allowedProtocols?: string[]): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);

    if (allowedProtocols && allowedProtocols.length > 0) {
      const protocol = parsed.protocol.replace(':', '');
      return allowedProtocols.includes(protocol);
    }

    // Default: only allow http and https
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// =============================================================================
// File Type Validation
// =============================================================================

/**
 * Validate file type against allowed extensions
 */
export function validateFileType(filename: string, allowedTypes: string[]): boolean {
  if (!filename || typeof filename !== 'string') return false;

  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension) return false;

  return allowedTypes.some((type) => type.toLowerCase() === extension);
}

// =============================================================================
// File Size Validation
// =============================================================================

/**
 * Validate file size against maximum
 */
export function validateFileSize(fileSize: number, maxSize: number): boolean {
  if (typeof fileSize !== 'number' || typeof maxSize !== 'number') return false;
  if (fileSize < 0 || maxSize < 0) return false;
  return fileSize <= maxSize;
}

// =============================================================================
// API Key Validation
// =============================================================================

const API_KEY_REGEX = /^(sk_test|pk_live|sk_live)_[a-zA-Z0-9]{16,}$/;

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') return false;
  if (apiKey.length < 20) return false;

  // Check for dangerous characters
  if (/[<>\s]/.test(apiKey)) return false;

  return API_KEY_REGEX.test(apiKey);
}

// =============================================================================
// Input Sanitization
// =============================================================================

export interface SanitizeOptions {
  maxLength?: number;
}

/**
 * Sanitize user input
 *
 * - Trims whitespace
 * - Removes null bytes
 * - Normalizes unicode
 * - Optionally limits length
 */
export function sanitizeInput(input: string, options?: SanitizeOptions): string {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') return '';

  let sanitized = input
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .normalize('NFC'); // Normalize unicode

  if (options?.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.slice(0, options.maxLength);
  }

  return sanitized;
}
