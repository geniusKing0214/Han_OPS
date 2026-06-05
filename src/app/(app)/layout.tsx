import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PwaSetupBanner } from "@/components/pwa/pwa-setup-banner";
import { WebPushProvider } from "@/components/providers/web-push-provider";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <WebPushProvider>
        <div className="flex min-h-screen min-w-0 overflow-x-clip">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col md:pl-60">
            <MobileTopBar />
            <AppHeader />
            <main className="flex-1 overflow-x-clip px-4 py-6 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+1rem)] md:px-8 md:py-10 md:pb-10">
              <div className="mx-auto w-full min-w-0 max-w-5xl">
                <PwaSetupBanner />
                {children}
              </div>
            </main>
            <MobileBottomNav />
          </div>
        </div>
      </WebPushProvider>
    </AuthGuard>
  );
}