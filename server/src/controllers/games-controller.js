function pageUrl(request, page) {
  const origin = `${request.protocol}://${request.get("host")}`;
  const url = new URL(request.originalUrl, origin);
  url.searchParams.set("page", String(page));
  return url.toString();
}

export class GamesController {
  constructor(service) {
    this.service = service;
  }

  list = (request, response) => {
    const result = this.service.list(request.query);
    const pageCount = Math.ceil(result.count / result.pageSize);
    response.json({
      count: result.count,
      next: result.page < pageCount ? pageUrl(request, result.page + 1) : null,
      previous: result.page > 1 && result.page <= pageCount + 1 ? pageUrl(request, result.page - 1) : null,
      page: result.page,
      page_size: result.pageSize,
      total_pages: pageCount,
      results: result.results
    });
  };

  detail = (request, response) => {
    response.json(this.service.detail(request.params.id));
  };

  metadata = (_request, response) => {
    response.json(this.service.metadata());
  };
}
