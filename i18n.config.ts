/**
 * Root i18n Configuration
 *
 * Declares only locales that have actual translations completed.
 * To add a new locale, ensure translations exist in both:
 *   - src/lib/i18n/config.ts  (inline messages)
 *   - locales/<code>/common.json  (JSON translation files)
 *
 * Locales with actual translations: en, es, fr, ar
 *
 * needsTranslation: de, he, it, ja, ko, nl, pl, pt, ru, tr, vi, zh, fa, ur
 */
interface I18nConfig {
  locales: string[];
  defaultLocale: string;
  localeDetector?: boolean;
  prefixDefault?: boolean;
}

export const i18nConfig: I18nConfig = {
  locales: ['en', 'es', 'fr', 'ar'],
  defaultLocale: 'en',
  localeDetector: false,
  prefixDefault: false,
};

export default i18nConfig;
