export class ApiResponse<T> {
  code: number;
  message: string;
  timestamp: string;
  data?: T;

  constructor({
    code = 200,
    message = 'Success',
    data,
  }: {
    code?: number;
    message?: string;
    data?: T;
  }) {
    this.code = code;
    this.message = message;
    this.timestamp = new Date().toISOString();
    this.data = data;
  }
}

export class ErrorResponse {
  code: number;
  message: string;
  timestamp: string;
  error: string;

  constructor({
    code,
    message,
    error,
  }: {
    code: number;
    message: string;
    error: string;
  }) {
    this.code = code;
    this.message = message;
    this.timestamp = new Date().toISOString();
    this.error = error;
  }
}
