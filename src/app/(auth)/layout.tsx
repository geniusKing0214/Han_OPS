export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="text-2xl font-semibold tracking-tight">
            <span className="text-foreground">HAN</span>
            <span className="ml-1 text-accent">OPS</span>
          </span>
          <p className="text-sm text-muted-foreground">딜러팀 스케줄 운영 플랫폼</p>
        </div>

        <div className="w-full">{children}</div>

        <p className="mt-8 text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} HAN OPS. All rights reserved.
        </p>
      </div>
    </main>
  );
}
