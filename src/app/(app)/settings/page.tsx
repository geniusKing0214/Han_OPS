import { AccountSummary } from "@/components/settings/account-summary";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { PushNotificationSettings } from "@/components/settings/push-notification-settings";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/page-header";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="프로필과 푸시 알림 설정을 관리합니다." />

      <AccountSummary />

      <ProfileSettingsForm />

      <Separator />

      <PushNotificationSettings />
    </div>
  );
}
