"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is enough to find it in the server log; the message itself may
    // carry private text, so it is not rendered.
    console.error("Unhandled error", error.digest);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="script text-4xl text-[var(--color-rose-deep)]">Có gì đó hỏng</p>
      <p className="max-w-sm text-sm text-[var(--color-ink-soft)]">
        Lỗi ở phía chúng tôi, không phải bạn. Những gì đã lưu vẫn nguyên vẹn.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          Thử lại
        </button>
        <a href="/app" className="btn btn-quiet">
          Về trang chính
        </a>
      </div>
      {error.digest ? (
        <p className="text-xs text-[var(--color-ink-faint)]">Mã lỗi: {error.digest}</p>
      ) : null}
    </main>
  );
}
