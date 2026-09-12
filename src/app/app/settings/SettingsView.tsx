"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Download, LogOut, RotateCcw, ShieldCheck } from "lucide-react";
import type { MomentDTO } from "@/server/moments";
import { api, ApiError } from "@/lib/client";
import { features } from "@/lib/features";
import { useAsyncData } from "@/lib/useAsyncData";
import MediaUploader, { type UploadedMedia } from "@/components/MediaUploader";
import { Avatar, ConfirmDialog, ErrorState, SectionHeading, Skeleton } from "@/components/ui";
import { formatDayShort } from "@/lib/formatDate";

type Me = {
  user: { id: string; email: string; displayName: string; avatarMediaId: string | null };
  space: {
    id: string;
    name: string;
    role: "OWNER" | "MEMBER";
    members: { userId: string; displayName: string; email: string; avatarMediaId: string | null }[];
    partner: { userId: string; displayName: string } | null;
  } | null;
};

type SpaceInfo = { space: { id: string; name: string; startDate: string | null } };

async function fetchSettings() {
  const [me, spaceRes] = await Promise.all([api.get<Me>("/me"), api.get<SpaceInfo>("/spaces/current")]);
  return { me, space: spaceRes.space };
}

export default function SettingsView() {
  const fetcher = useCallback(() => fetchSettings(), []);
  const { data, error, reload } = useAsyncData(fetcher, "Không tải được cài đặt.");

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-96 w-full" />;

  const { me, space } = data;
  const load = reload;

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-10">
      <h1 className="display underlined text-3xl">Cài đặt</h1>

      <SpaceSection space={space} me={me} onChanged={load} />
      <InviteSection hasPartner={Boolean(me.space?.partner)} />
      <ProfileSection me={me} onChanged={load} />
      <PasswordSection />
      <PrivacySection />
      <ExportSection />
      {features.moments ? <RecentlyDeletedSection /> : null}
      <DangerSection me={me} space={space} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function SpaceSection({
  space,
  me,
  onChanged,
}: {
  space: SpaceInfo["space"];
  me: Me;
  onChanged: () => void;
}) {
  const [name, setName] = useState(space.name);
  const [startDate, setStartDate] = useState(space.startDate ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch("/spaces/current", { name: name.trim(), startDate: startDate || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionHeading title="Không gian chung" />
      <form onSubmit={save} className="card space-y-4 p-5">
        {error ? <ErrorState message={error} /> : null}

        <div>
          <label className="label" htmlFor="space-name">
            Tên
          </label>
          <input
            id="space-name"
            className="field"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="space-start">
            Ngày bắt đầu
          </label>
          <input
            id="space-start"
            type="date"
            className="field"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
            Dùng để đếm ngày. Để trống thì không hiện bộ đếm.
          </p>
        </div>

        <div>
          <span className="label">Thành viên</span>
          <ul className="space-y-2">
            {me.space?.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2 text-sm">
                <Avatar name={m.displayName} mediaId={m.avatarMediaId} size={26} />
                <span className="text-[var(--color-ink)]">{m.displayName}</span>
                <span className="text-[var(--color-ink-faint)]">{m.email}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
          {saved ? (
            <span className="flex items-center gap-1.5 text-sm text-[var(--color-sage)]">
              <Check size={15} aria-hidden />
              Đã lưu
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function InviteSection({ hasPartner }: { hasPartner: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasPartner) {
    return (
      <section>
        <SectionHeading title="Lời mời" />
        <p className="card px-5 py-4 text-sm text-[var(--color-ink-soft)]">
          Cả hai đã ở trong không gian này rồi, không cần mời nữa.
        </p>
      </section>
    );
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ invite: { url: string } }>("/spaces/current/invites");
      setUrl(res.invite.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tạo được link mời.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is on screen.
    }
  }

  return (
    <section>
      <SectionHeading title="Mời người kia" />
      <div className="card space-y-3 p-5">
        {error ? <ErrorState message={error} /> : null}
        <p className="text-sm text-[var(--color-ink-soft)]">
          Link mới dùng được một lần và hết hạn sau bảy ngày. Tạo link mới sẽ huỷ link cũ.
        </p>

        {url ? (
          <>
            <div className="rounded-[var(--radius-drawn)] bg-[var(--color-paper-deep)] p-3">
              <p className="break-all font-mono text-xs">{url}</p>
            </div>
            <button type="button" onClick={copy} className="btn btn-quiet">
              {copied ? (
                <>
                  <Check size={16} aria-hidden /> Đã chép
                </>
              ) : (
                <>
                  <Copy size={16} aria-hidden /> Chép link
                </>
              )}
            </button>
          </>
        ) : null}

        <button type="button" onClick={create} className="btn btn-primary" disabled={busy}>
          {busy ? "Đang tạo…" : url ? "Tạo link mới" : "Tạo link mời"}
        </button>
      </div>
    </section>
  );
}

function ProfileSection({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const [displayName, setDisplayName] = useState(me.user.displayName);
  const [avatar, setAvatar] = useState<UploadedMedia[]>(
    me.user.avatarMediaId
      ? [{ id: me.user.avatarMediaId, width: 1, height: 1, mimeType: "image/jpeg" }]
      : [],
  );
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch("/me", {
        displayName: displayName.trim(),
        avatarMediaId: avatar[0]?.id ?? null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được hồ sơ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionHeading title="Tài khoản của bạn" />
      <form onSubmit={save} className="card space-y-4 p-5">
        {error ? <ErrorState message={error} /> : null}

        <div>
          <label className="label" htmlFor="display-name">
            Tên hiển thị
          </label>
          <input
            id="display-name"
            className="field"
            required
            maxLength={60}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <MediaUploader media={avatar} onChange={setAvatar} max={1} label="Ảnh của bạn" addLabel="Chọn ảnh" />

        <p className="text-xs text-[var(--color-ink-faint)]">Đang đăng nhập bằng {me.user.email}</p>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
          {saved ? (
            <span className="flex items-center gap-1.5 text-sm text-[var(--color-sage)]">
              <Check size={15} aria-hidden />
              Đã lưu
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setCurrent("");
      setNew("");
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không đổi được mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionHeading title="Mật khẩu" />
      <form onSubmit={save} className="card space-y-4 p-5">
        {error ? <ErrorState message={error} /> : null}
        {done ? (
          <p className="text-sm text-[var(--color-sage)]">
            Đã đổi mật khẩu. Mọi thiết bị khác đã bị đăng xuất.
          </p>
        ) : null}

        <div>
          <label className="label" htmlFor="current-password">
            Mật khẩu hiện tại
          </label>
          <input
            id="current-password"
            type="password"
            className="field"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="new-password">
            Mật khẩu mới
          </label>
          <input
            id="new-password"
            type="password"
            className="field"
            required
            minLength={10}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-quiet" disabled={busy}>
          {busy ? "Đang đổi…" : "Đổi mật khẩu"}
        </button>
      </form>
    </section>
  );
}

function PrivacySection() {
  return (
    <section>
      <SectionHeading title="Riêng tư" />
      <div className="card space-y-3 p-5 text-sm text-[var(--color-ink-soft)]">
        <p className="flex items-start gap-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--color-sage)]" aria-hidden />
          <span>
            Mọi thứ lưu ở đây chỉ hai người trong không gian này nhìn thấy, không ai khác. Không có trang
            công khai, không có bảng tin.
          </span>
        </p>
        <ul className="ml-1 list-disc space-y-1.5 pl-5">
          <li>Ảnh được lưu riêng tư, chỉ gửi cho thành viên đã đăng nhập của không gian này.</li>
          <li>Vị trí là do bạn tự gõ. App không đọc GPS, danh bạ hay thư viện ảnh của bạn.</li>
          <li>Ảnh không giữ metadata máy ảnh: ảnh được mã hoá lại khi tải lên, xoá EXIF và GPS.</li>
          <li>Bạn có thể tải về tất cả, và xoá tất cả, ngay tại trang này.</li>
        </ul>
      </div>
    </section>
  );
}

function ExportSection() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(withPhotos: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/exports?photos=${withPhotos ? "1" : "0"}`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? "our-space.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Không tạo được bản xuất. Nếu nhiều ảnh quá, thử xuất không kèm ảnh trước.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionHeading title="Tải dữ liệu về" />
      <div className="card space-y-3 p-5">
        {error ? <ErrorState message={error} /> : null}
        <p className="text-sm text-[var(--color-ink-soft)]">
          Một file ZIP chứa mọi thứ bạn đã lưu, dạng JSON thuần — vài năm nữa vẫn đọc được mà không cần
          app này.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => download(true)} className="btn btn-primary" disabled={busy}>
            <Download size={16} aria-hidden />
            {busy ? "Đang chuẩn bị…" : "Tải về kèm ảnh"}
          </button>
          {features.moments || features.memories ? (
            <button type="button" onClick={() => download(false)} className="btn btn-quiet" disabled={busy}>
              Chỉ dữ liệu
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RecentlyDeletedSection() {
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetcher = useCallback(() => api.get<{ items: MomentDTO[] }>("/moments/deleted"), []);
  const { data, error, reload } = useAsyncData(fetcher);

  if (error) return null;
  if (!data) return <Skeleton className="h-20 w-full" />;

  const items = data.items;
  if (items.length === 0) return null;

  return (
    <section>
      <SectionHeading title="Vừa xoá" hint="Khôi phục được trong 30 ngày." />
      <ul className="card divide-y divide-[var(--color-line)]">
        {items.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] text-[var(--color-ink)]">
                {m.caption?.slice(0, 70) || "Không có chữ"}
              </p>
              <p className="text-xs text-[var(--color-ink-faint)]">{formatDayShort(m.localDate)}</p>
            </div>
            <button
              type="button"
              className="btn btn-quiet shrink-0 text-sm"
              disabled={busyId === m.id}
              onClick={async () => {
                setBusyId(m.id);
                try {
                  await api.post(`/moments/${m.id}/restore`);
                  reload();
                } finally {
                  setBusyId(null);
                }
              }}
            >
              <RotateCcw size={15} aria-hidden />
              Khôi phục
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DangerSection({ me, space }: { me: Me; space: SpaceInfo["space"] }) {
  const [dialog, setDialog] = useState<"leave" | "deleteSpace" | "deleteAccount" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = me.space?.role === "OWNER";
  const hasPartner = Boolean(me.space?.partner);

  async function run(action: () => Promise<void>, destination: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      window.location.href = destination;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thực hiện được.");
      setBusy(false);
      setDialog(null);
    }
  }

  return (
    <section>
      <SectionHeading title="Tài khoản" />
      <div className="card space-y-3 p-5">
        {error ? <ErrorState message={error} /> : null}

        <button
          type="button"
          className="btn btn-quiet w-full sm:w-auto"
          onClick={() => void run(() => api.post("/auth/logout"), "/login")}
        >
          <LogOut size={16} aria-hidden />
          Đăng xuất
        </button>

        <hr className="border-[var(--color-line)]" />

        <div className="space-y-3">
          {hasPartner ? (
            <div>
              <button type="button" className="btn btn-quiet" onClick={() => setDialog("leave")}>
                Rời không gian này
              </button>
              <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
                Những gì bạn đã lưu vẫn ở lại cho {me.space?.partner?.displayName}. Người đó thành chủ không gian.
              </p>
            </div>
          ) : null}

          {isOwner ? (
            <div>
              <button type="button" className="btn btn-danger" onClick={() => setDialog("deleteSpace")}>
                Xoá không gian này
              </button>
              <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
                Xoá sạch mọi thứ của cả hai người. Không khôi phục được — hãy tải dữ liệu về trước.
              </p>
            </div>
          ) : null}

          <div>
            <button type="button" className="btn btn-danger" onClick={() => setDialog("deleteAccount")}>
              Xoá tài khoản của tôi
            </button>
            <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
              {hasPartner
                ? "Tài khoản của bạn bị đóng và thông tin cá nhân bị xoá, nhưng những gì bạn đã viết vẫn ở lại — đó cũng là kỷ niệm của người kia."
                : "Vì ở đây chỉ có mình bạn, thao tác này xoá luôn cả không gian và mọi thứ trong đó."}
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "leave"}
        title="Rời không gian này?"
        body="Bạn sẽ mất quyền xem mọi thứ trong đó. Những gì bạn đã lưu vẫn ở lại cho người kia."
confirmLabel="Rời đi"
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => void run(() => api.post("/spaces/current/leave"), "/onboarding")}
      />

      <ConfirmDialog
        open={dialog === "deleteSpace"}
        title="Xoá không gian này?"
        body="Mọi thứ của cả hai người sẽ mất. Không có cách hoàn tác."
        confirmLabel="Xoá tất cả"
        requirePhrase={space.name}
        phraseHint={`Gõ tên không gian (${space.name}) để xác nhận`}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={(phrase) => void run(() => api.del("/spaces/current", { confirmName: phrase }), "/login")}
      />

      <ConfirmDialog
        open={dialog === "deleteAccount"}
        title="Xoá tài khoản của bạn?"
        body="Tài khoản của bạn sẽ bị đóng vĩnh viễn."
        confirmLabel="Xoá tài khoản"
        requirePhrase={me.user.email}
        phraseHint="Gõ địa chỉ email của bạn để xác nhận"
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={(phrase) => void run(() => api.del("/me", { confirmEmail: phrase }), "/login")}
      />
    </section>
  );
}
