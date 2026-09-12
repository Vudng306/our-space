export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="script text-4xl text-[var(--color-rose-deep)]">Our Space</p>
          <p className="display mt-1 text-lg text-[var(--color-ink-soft)]">
            Một nơi riêng của hai người.
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
