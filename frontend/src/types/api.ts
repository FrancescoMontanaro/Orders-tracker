/**
 * Represents a successful API response.
 */
export type SuccessResponse<T> = { status: 'success'; data: T };

/**
 * Represents a paginated response.
 */
export type Pagination<T> = { total: number; items: T[] };