import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AccountSummary } from "@/components/settings/account-summary";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          프로필은 Firestore에 저장됩니다. 알림 등은 추후 연동 예정입니다.
        </p>
      </div>

      <AccountSummary />

      <ProfileSettingsForm />

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">알림</CardTitle>
          <CardDescription>승인·공지 알림 (추후 연동)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled>
            이메일
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            인앱
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
