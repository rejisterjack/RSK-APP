import type { Schemas } from '@qdrant/js-client-rest';
import type { RetrievalFilters, RetrievalOptions } from '@/lib/rag/retrieval/types';

type Filter = Schemas['Filter'];

export function buildQdrantFilter(options: {
  userId?: string;
  workspaceId?: string;
  filters?: RetrievalFilters;
}): Filter | undefined {
  const must: NonNullable<Filter['must']> = [];
  const should: NonNullable<Filter['should']> = [];

  if (options.userId && options.workspaceId) {
    should.push(
      { key: 'userId', match: { value: options.userId } },
      { key: 'workspaceId', match: { value: options.workspaceId } }
    );
  } else if (options.userId) {
    must.push({ key: 'userId', match: { value: options.userId } });
  } else if (options.workspaceId) {
    must.push({ key: 'workspaceId', match: { value: options.workspaceId } });
  }

  const filters = options.filters;
  if (filters) {
    if (filters.documentIds?.length) {
      must.push({ key: 'documentId', match: { any: filters.documentIds } });
    }
    if (filters.documentTypes?.length) {
      must.push({ key: 'documentType', match: { any: filters.documentTypes } });
    }
    if (filters.dateRange) {
      must.push(
        { key: 'createdAt', range: { gte: filters.dateRange.from.getTime() } },
        { key: 'createdAt', range: { lte: filters.dateRange.to.getTime() } }
      );
    }
    if (filters.userId) {
      must.push({ key: 'userId', match: { value: filters.userId } });
    }
  }

  if (must.length === 0 && should.length === 0) return undefined;

  const filter: Filter = {};
  if (must.length > 0) filter.must = must;
  if (should.length > 0) filter.should = should;
  return filter;
}

export function buildQdrantFilterFromRetrievalOptions(options: RetrievalOptions): Filter | undefined {
  return buildQdrantFilter({
    userId: options.userId,
    workspaceId: options.workspaceId,
    filters: options.filters,
  });
}
