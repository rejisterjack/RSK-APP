/**
 * Re-export from the actual test utilities.
 * This allows imports via @/tests/utils/fixtures/documents to resolve correctly
 * since @ alias points to ./src.
 */

export {
  createMockFile,
  mockImageFile,
  mockInvalidFile,
  mockOversizedFile,
  mockPDFFile,
  mockTextFile,
  mockWordFile,
  sampleDocuments,
  sampleErrorDocument,
  sampleFinancialReportContent,
  samplePDFDocument,
  sampleProcessingDocument,
  sampleTechnicalDocumentation,
  sampleTextDocument,
  sampleWordDocument,
} from '../../../../tests/utils/fixtures/documents';
