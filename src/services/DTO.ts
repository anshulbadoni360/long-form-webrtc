export class ResponseDto<T = unknown> {
  success: boolean;
  error: boolean;
  message: string;
  data?: T;
  errors?: unknown;

  constructor({
    success = true,
    error = false,
    message = "",
    data,
    errors,
  }: {
    success?: boolean;
    error?: boolean;
    message?: string;
    data?: T;
    errors?: unknown;
  }) {
    this.success = success;
    this.error = error;
    this.message = message;
    this.data = data;
    this.errors = errors;
  }

  static ok<T>(data?: T, message = "Success") {
    return new ResponseDto<T>({
      success: true,
      error: false,
      message,
      data,
    });
  }

  static fail(message = "Failed", errors?: unknown) {
    return new ResponseDto({
      success: false,
      error: true,
      message,
      errors,
    });
  }
}
