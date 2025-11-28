export class HttpError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message?: string, details?: unknown) {
    super(message ?? code);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(code: string = 'AUTH_REQUIRED', details?: unknown, message?: string) {
    super(401, code, message ?? 'Authentication required', details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(code: string = 'PERMISSION_DENIED', details?: unknown, message?: string) {
    super(403, code, message ?? 'You do not have permission to perform this action', details);
  }
}

export class BadRequestError extends HttpError {
  constructor(code: string = 'BAD_REQUEST', message?: string, details?: unknown) {
    super(400, code, message ?? 'Bad request', details);
  }
}

export class NotFoundError extends HttpError {
  constructor(code: string = 'NOT_FOUND', message?: string, details?: unknown) {
    super(404, code, message ?? 'Resource not found', details);
  }
}

export class ConflictError extends HttpError {
  constructor(code: string = 'CONFLICT', message?: string, details?: unknown) {
    super(409, code, message ?? 'Conflict', details);
  }
}
