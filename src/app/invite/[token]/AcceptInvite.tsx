"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { ErrorState } from "@/components/ui";

export default function AcceptInvite({ token, spaceName }: { token: string; spaceName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/invites/${encodeURIComponent(token)}/accept`);
      // refresh() so the app layout re-reads the membership that just appeared.
      router.replace("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chưa tham gia được lúc này.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorState message={error} /> : null}
      <button type="button" onClick={accept} className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Đang vào…" : `Vào ${spaceName}`}
      </button>
    </div>
  );
}
