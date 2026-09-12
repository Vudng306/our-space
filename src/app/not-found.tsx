import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="script text-4xl text-[var(--color-rose-deep)]">Không có ở đây</p>
      <p className="max-w-sm text-sm text-[var(--color-ink-soft)]">
        Trang này không tồn tại, hoặc thuộc về một không gian bạn không ở trong đó.
      </p>
      <Link href="/app" className="btn btn-primary">
        Về không gian của mình
      </Link>
    </main>
  );
}
