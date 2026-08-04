export interface PaginateDatasourceDTO<T> {
  docs: T[]
  totalDocs: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
  page: number
  limit: number
  prevPage: number
  nextPage: number
}
