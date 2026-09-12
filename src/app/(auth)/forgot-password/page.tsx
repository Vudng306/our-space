"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client";
import { ErrorState } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ devLink?: string }>("/auth/forgot-password", { email });
      setDevLink(res.devLink ?? null);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chưa gửi được link lúc này.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card space-y-4 p-6">
        <h1 className="display text-2xl">Kiểm tra email</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Nếu địa chỉ này có tài khoản, link đặt lại mật khẩu đang trên đường tới. Link hết hạn sau một giờ.
        </p>
        {devLink ? (
          <div className="rounded-[var(--radius-drawn)] bg-[var(--color-paper-deep)] p-3 text-sm">
            <p className="mb-1 font-medium text-[var(--color-ink)]">Chế độ phát triển</p>
            <p className="mb-2 text-[var(--color-ink-soft)]">
              Chưa cấu hình máy chủ mail, nên đây là link trực tiếp:
            </p>
            <a href={devLink} className="break-all text-[var(--color-rose)] underline underline-offset-2">
              {devLink}
            </a>
          </div>
        ) : null}
        <Link href="/login" className="btn btn-quiet w-full">
          Quay lại đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <h1 className="display text-2xl">Đặt lại mật khẩu</h1>
      <p className="text-sm text-[var(--color-ink-soft)]">
        Nhập email bạn đã đăng ký, chúng tôi sẽ gửi link.
      </p>

      {error ? <ErrorState message={error} /> : null}

      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="field"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Đang gửi…" : "Gửi link"}
      </button>

      <p className="text-center text-sm">
        <Link href="/login" className="text-[var(--color-ink-soft)] underline underline-offset-2">
          Quay lại đăng nhập
        </Link>
      </p>
    </form>
  );
}
