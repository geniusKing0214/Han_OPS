import { AccountSummary } from "@/components/settings/account-summary";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { PushNotificationSettings } from "@/components/settings/push-notification-settings";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          프로필과 푸시 알림 설정을 관리합니다.
        </p>
      </div>

      <AccountSummary />

      <ProfileSettingsForm />

      <Separator />

      <PushNotificationSettings />
    </div>
  );
}
