export const DEFAULT_POST_LIMIT = 10;
export const MAX_POST_LIMIT = 50;
export const DEFAULT_COMMENT_LIMIT = 10;
export const MAX_COMMENT_LIMIT = 50;

export const normalizeLimit = (value, fallback, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

export const normalizeOffset = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

export const buildPage = ({ items, totalCount, offset }) => {
  const nextOffset = offset + items.length;
  const hasMore = nextOffset < totalCount;

  return {
    items,
    totalCount,
    hasMore,
    nextOffset: hasMore ? nextOffset : null,
  };
};
