/** An error with an HTTP status, safe to show to the client. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
