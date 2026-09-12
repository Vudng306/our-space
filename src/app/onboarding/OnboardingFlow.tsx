"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import { ErrorState } from "@/components/ui";

type Invite = { url: string; expiresAt: string };

export default function OnboardingFlow({ displayName }: { displayName: string }) {
  const [step, setStep] = useState<"space" | "invite">("space");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createSpace(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/spaces", { name, startDate: startDate || null });
      const res = await api.post<{ invite: Invite }>("/spaces/current/invites");
      setInvite(res.invite);
      setStep("invite");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chưa tạo được không gian lúc này.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is on screen to copy by hand.
    }
  }

  if (step === "invite" && invite) {
    return (
      <div className="card space-y-5 p-6">
        <div>
          <h1 className="display text-2xl">Mời người kia</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Gửi link này cho họ. Link dùng được một lần, hết hạn sau bảy ngày.
          </p>
        </div>

        <div className="rounded-[var(--radius-drawn)] border border-[var(--color-line)] bg-[var(--color-paper-deep)] p-3">
          <p className="break-all font-mono text-xs text-[var(--color-ink)]">{invite.url}</p>
        </div>

        <button type="button" onClick={copyLink} className="btn btn-quiet w-full">
          {copied ? (
            <>
              <Check size={16} aria-hidden /> Đã chép
            </>
          ) : (
            <>
              <Copy size={16} aria-hidden /> Chép link mời
            </>
          )}
        </button>

        <a href="/app" className="btn btn-primary w-full">
          Vào không gian chung
        </a>

        <p className="text-center text-xs text-[var(--color-ink-faint)]">
          Bạn có thể tạo link mới bất cứ lúc nào trong phần Cài đặt.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={createSpace} className="card space-y-5 p-6">
      <div>
        <h1 className="display text-2xl">Chào {displayName}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Cùng dựng không gian riêng của hai người nhé.
        </p>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <div>
        <label className="label" htmlFor="space-name">
          Đặt tên cho không gian này
        </label>
        <input
          id="space-name"
          className="field"
          required
          maxLength={80}
          placeholder="Hai chúng mình"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="start-date">
          Ngày bắt đầu (không bắt buộc)
        </label>
        <input
          id="start-date"
          type="date"
          className="field"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
          Dùng để đếm ngày ở trang chính. Điền sau cũng được.
        </p>
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Đang tạo…" : "Tạo không gian"}
      </button>
    </form>
  );
}
