import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** An error that is safe to surface to the client with a specific status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (m: string, details?: unknown) => new HttpError(400, m, "bad_request", details);
export const unauthorized = (m = "Bạn cần đăng nhập.") => new HttpError(401, m, "unauthorized");
export const forbidden = (m = "Bạn không có quyền xem cái này.") => new HttpError(403, m, "forbidden");
export const notFound = (m = "Không tìm thấy.") => new HttpError(404, m, "not_found");
export const conflict = (m: string) => new HttpError(409, m, "conflict");
export const tooLarge = (m: string) => new HttpError(413, m, "payload_too_large");
export const tooMany = (m = "Thử hơi nhiều lần rồi. Đợi một chút nhé.") =>
  new HttpError(429, m, "rate_limited");

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Wraps a route handler so thrown errors become clean JSON. Unexpected errors
 * are logged server-side but never leak their message or stack to the client.
 */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json(
          { error: { code: err.code ?? "error", message: err.message, details: err.details } },
          { status: err.status },
        );
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Có vài chỗ cần sửa lại.",
              details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
            },
          },
          { status: 422 },
        );
      }
      // Captions and other private text must never reach the log (spec §8.1).
      console.error("[api] unhandled error", err instanceof Error ? err.stack : err);
      return NextResponse.json(
        { error: { code: "internal_error", message: "Có lỗi ở phía chúng tôi." } },
        { status: 500 },
      );
    }
  };
}

/** Parses a JSON body, turning malformed input into a 400 rather than a 500. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Dữ liệu gửi lên không hợp lệ.");
  }
}
