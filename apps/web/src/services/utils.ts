export interface Paginated<T> {
  data: Array<T>
  total: number
  page: number
  limit: number
  pages: number
}

/** Page params accepted by list endpoints. */
export interface PageParams {
  page?: number
  limit?: number
}
