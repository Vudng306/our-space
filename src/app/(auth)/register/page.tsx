"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { ErrorState } from "@/components/ui";

function RegisterForm() {
  const params = useSearchParams();
  const inviteToken = params.get("invite");

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<{ joinedSpace: boolean }>("/auth/register", {
        displayName,
        email,
        password,
        ...(inviteToken ? { inviteToken } : {}),
      });
      window.location.href = result.joinedSpace ? "/app" : "/onboarding";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chưa tạo được tài khoản lúc này.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <h1 className="display text-2xl">{inviteToken ? "Vào không gian chung" : "Tạo tài khoản"}</h1>

      {inviteToken ? (
        <p className="rounded-[var(--radius-drawn)] bg-[var(--color-rose-soft)] px-3 py-2 text-sm text-[var(--color-rose-deep)]">
          Đăng ký xong là bạn vào thẳng không gian được mời.
        </p>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      <div>
        <label className="label" htmlFor="displayName">
          Nên gọi bạn là gì
        </label>
        <input
          id="displayName"
          className="field"
          required
          maxLength={60}
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

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

      <div>
        <label className="label" htmlFor="password">
          Mật khẩu
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
        {busy ? "Đang tạo…" : "Tạo tài khoản"}
      </button>

      <p className="pt-1 text-center text-sm text-[var(--color-ink-soft)]">
        Đã có tài khoản?{" "}
        <Link href="/login" className="text-[var(--color-rose)] underline underline-offset-2">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <RegisterForm />
    </Suspense>
  );
}
