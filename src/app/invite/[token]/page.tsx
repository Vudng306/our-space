import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getSpaceContextForUser } from "@/lib/space";
import { peekInvite } from "@/server/spaces";
import AcceptInvite from "./AcceptInvite";

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  unknown: "Link mời không hợp lệ. Hãy xin link mới.",
  used: "Link mời này đã được dùng rồi.",
  revoked: "Link mời này đã bị huỷ.",
  expired: "Link mời đã hết hạn. Hãy xin link mới.",
  full: "Không gian đó đã đủ hai người.",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await peekInvite(token);
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="script text-4xl text-[var(--color-rose-deep)]">Our Space</p>
        </div>

        {!invite.valid ? (
          <div className="card space-y-4 p-6 text-center">
            <h1 className="display text-2xl">Không dùng được link này</h1>
            <p className="text-sm text-[var(--color-ink-soft)]">
              {REASONS[invite.reason] ?? REASONS.unknown}
            </p>
            <Link href="/login" className="btn btn-quiet w-full">
              Tới trang đăng nhập
            </Link>
          </div>
        ) : (
          <InviteBody
            token={token}
            spaceName={invite.spaceName}
            invitedBy={invite.invitedBy}
            userId={user?.id ?? null}
          />
        )}
      </div>
    </main>
  );
}

async function InviteBody({
  token,
  spaceName,
  invitedBy,
  userId,
}: {
  token: string;
  spaceName: string;
  invitedBy: string;
  userId: string | null;
}) {
  const user = userId ? await getCurrentUser() : null;
  const existing = user ? await getSpaceContextForUser(user) : null;

  return (
    <div className="card space-y-5 p-6">
      <div className="text-center">
        <h1 className="display text-2xl">
          {invitedBy} mời bạn vào {spaceName}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          Mọi thứ hai người lưu đều nằm trong không gian này. Không ai khác xem được.
        </p>
      </div>

      {!user ? (
        <div className="space-y-2">
          <Link href={`/register?invite=${encodeURIComponent(token)}`} className="btn btn-primary w-full">
            Tạo tài khoản và tham gia
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
            className="btn btn-quiet w-full"
          >
            Tôi đã có tài khoản
          </Link>
        </div>
      ) : existing ? (
        <div className="space-y-3">
          <p className="rounded-[var(--radius-drawn)] bg-[var(--color-paper-deep)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
            Bạn đang ở trong <strong className="text-[var(--color-ink)]">{existing.space.name}</strong>. Hãy rời
            không gian đó trong Cài đặt trước khi tham gia không gian khác.
          </p>
          <Link href="/app/settings" className="btn btn-quiet w-full">
            Mở cài đặt
          </Link>
        </div>
      ) : (
        <AcceptInvite token={token} spaceName={spaceName} />
      )}
    </div>
  );
}
