export type DataErrorCode = "NOT_FOUND" | "UNAVAILABLE" | "CONFLICT" | "UNAUTHORIZED" | "UNKNOWN";

export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: DataErrorCode = "UNKNOWN", cause?: unknown) {
    super(message);
    this.name = "DataError";
    this.code = code;
    this.cause = cause;
  }
}

export async function withData<T>(op: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DataError) throw error;
    throw new DataError(`${op} failed`, "UNKNOWN", error);
  }
}

export function dataErrorResponse(error: unknown) {
  if (error instanceof DataError) {
    const status =
      error.code === "NOT_FOUND" ? 404 : error.code === "UNAVAILABLE" ? 503 : error.code === "UNAUTHORIZED" ? 401 : 500;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  console.error(error);
  return Response.json({ error: "Unexpected data error" }, { status: 500 });
}
