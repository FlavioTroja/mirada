# Responses

1. Return raw entities / arrays / pagination DTOs directly. **No `{ data, error }` envelope.**
2. Pagination uses `PaginateDatasourceDTO` from `@DTOs/paginate/PaginateDTO`, produced by `BaseRepository.paginate`.
3. **Bulk operations** may return an array of per-item result objects, each carrying the successful payload and an optional `error` field for the items that failed. This lets a single request report partial success without throwing for the whole batch.
