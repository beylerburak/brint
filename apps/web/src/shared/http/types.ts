export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpError {
  ok: false;
  status: number;
  message: string;
  details?: any;
}

export interface HttpSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export type HttpResponse<T> = HttpSuccess<T> | HttpError;

