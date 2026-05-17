import { qdrant, COLLECTION_DOCUMENT_CHUNKS, COLLECTION_IMAGE_EMBEDDINGS } from '@/lib/qdrant';

export interface VectorStats {
  totalVectors: number;
  documentStats: Array<{
    documentId: string;
    documentName: string;
    chunkCount: number;
    hasEmbeddings: boolean;
  }>;
}

export interface IndexStats {
  indexName: string;
  indexType: string;
  tableName: string;
  columnName: string;
  size: string;
  rows: number;
}

export interface HNSWIndexOptions {
  dimensions: number;
  m?: number;
  efConstruction?: number;
  distanceMetric?: 'cosine' | 'l2' | 'ip';
}

export interface IVFFlatIndexOptions {
  dimensions: number;
  lists: number;
  distanceMetric?: 'cosine' | 'l2' | 'ip';
}

export async function getVectorStats(): Promise<VectorStats> {
  try {
    const info = await qdrant.getCollection(COLLECTION_DOCUMENT_CHUNKS);
    return {
      totalVectors: info.points_count ?? 0,
      documentStats: [],
    };
  } catch {
    return { totalVectors: 0, documentStats: [] };
  }
}

export async function getGlobalVectorStats(): Promise<{
  totalVectors: number;
  totalDocuments: number;
  indexSize: string;
  tableSize: string;
}> {
  try {
    const [chunkInfo, imageInfo] = await Promise.all([
      qdrant.getCollection(COLLECTION_DOCUMENT_CHUNKS).catch(() => null),
      qdrant.getCollection(COLLECTION_IMAGE_EMBEDDINGS).catch(() => null),
    ]);
    return {
      totalVectors: (chunkInfo?.points_count ?? 0) + (imageInfo?.points_count ?? 0),
      totalDocuments: 0,
      indexSize: 'N/A (Qdrant)',
      tableSize: 'N/A (Qdrant)',
    };
  } catch {
    return { totalVectors: 0, totalDocuments: 0, indexSize: '0 bytes', tableSize: '0 bytes' };
  }
}

// Stubs for backward compatibility — Qdrant manages indexes internally
export function createHNSWIndex(): Promise<void> { return Promise.resolve(); }
export function createIVFFlatIndex(): Promise<void> { return Promise.resolve(); }
export function dropHNSWIndex(): Promise<void> { return Promise.resolve(); }
export function dropIVFFlatIndex(): Promise<void> { return Promise.resolve(); }
export function setHNSWEfSearch(): Promise<void> { return Promise.resolve(); }
export function setIVFFlatProbes(): Promise<void> { return Promise.resolve(); }
export function analyzeVectorIndex(): Promise<IndexStats[]> { return Promise.resolve([]); }
export function listVectorIndexes(): Promise<IndexStats[]> { return Promise.resolve([]); }
export function reindexVector(): Promise<void> { return Promise.resolve(); }
export function vacuumVectorTable(): Promise<void> { return Promise.resolve(); }
export function findDuplicateVectors(): Promise<Array<{ content: string; count: number; ids: string[] }>> { return Promise.resolve([]); }
export function removeOrphanedVectors(): Promise<number> { return Promise.resolve(0); }
export function calculateOptimalLists(): number { return 1; }
export function calculateHNSWParams(): { m: number; efConstruction: number } { return { m: 16, efConstruction: 64 }; }
