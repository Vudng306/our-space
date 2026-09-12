"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { ErrorState } from "@/components/ui";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/login", { email, password });
      // A full navigation so the server re-reads the new session cookie.
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chưa đăng nhập được lúc này.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <h1 className="display text-2xl">Chào bạn</h1>

      {error ? <ErrorState message={error} /> : null}

      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="field"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          className="field"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Đang vào…" : "Đăng nhập"}
      </button>

      <div className="flex items-center justify-between pt-1 text-sm">
        <Link href="/forgot-password" className="text-[var(--color-ink-soft)] underline underline-offset-2">
          Quên mật khẩu
        </Link>
        <Link href="/register" className="text-[var(--color-rose)] underline underline-offset-2">
          Tạo tài khoản
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card h-80 animate-pulse" />}>
      <LoginForm />
    </Suspense>
  );
}
