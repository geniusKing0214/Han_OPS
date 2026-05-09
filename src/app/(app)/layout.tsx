import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex flex-1 flex-col md:pl-60">
          <MobileTopBar />
          <main className="flex-1 px-4 py-6 pb-28 md:px-8 md:py-10 md:pb-10">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </AuthGuard>
  );
}
