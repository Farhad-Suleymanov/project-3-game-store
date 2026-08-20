export function notFoundHandler(request, response) {
  response.status(404).json({
    error: {
      status: 404,
      message: `Route ${request.method} ${request.originalUrl} was not found.`
    }
  });
}

export function errorHandler(error, _request, response, _next) {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(error);
  response.status(status).json({
    error: {
      status,
      message: status >= 500 ? "Internal server error." : error.message,
      ...(error.details === undefined ? {} : { details: error.details })
    }
  });
}
