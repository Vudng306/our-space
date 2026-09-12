"use client";

import { use, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client";
import { ErrorState } from "@/components/ui";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chưa đặt lại được mật khẩu lúc này.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card space-y-4 p-6">
        <h1 className="display text-2xl">Đã đổi mật khẩu</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Mọi thiết bị khác đã bị đăng xuất. Đăng nhập lại bằng mật khẩu mới.
        </p>
        <Link href="/login" className="btn btn-primary w-full">
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <h1 className="display text-2xl">Chọn mật khẩu mới</h1>

      {error ? <ErrorState message={error} /> : null}

      <div>
        <label className="label" htmlFor="password">
          Mật khẩu mới
        </label>
        <input
          id="password"
          type="password"
          className="field"
          required
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">Ít nhất 10 ký tự.</p>
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Đang lưu…" : "Lưu mật khẩu mới"}
      </button>
    </form>
  );
}
