"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { updateOwnProfile } from "@/lib/firestore-users";
import { formatPhoneInput } from "@/lib/phone-format";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ProfileSettingsForm() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const phoneRequired = searchParams.get("require") === "phone";

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setPhone(formatPhoneInput(profile.phone ?? ""));
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    if (!phone.trim()) {
      setFeedback({ kind: "err", text: "연락처는 필수 입력 항목입니다." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await updateOwnProfile(user.uid, { displayName, phone });
      if (phoneRequired) {
        router.replace("/dashboard");
        return;
      }
      setFeedback({ kind: "ok", text: "저장했습니다." });
    } catch (err) {
      setFeedback({
        kind: "err",
        text:
          err instanceof Error
            ? err.message
            : "저장에 실패했습니다. 네트워크와 Firestore 규칙을 확인하세요.",
      });
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || !user || saving;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">개인정보</CardTitle>
        <CardDescription>이메일 · 표시 이름 · 연락처</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : (
          <>
            {phoneRequired && !profile?.phone ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                서비스 이용을 위해 연락처를 등록해 주세요.
              </p>
            ) : null}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                이메일
              </label>
              <Input
                value={user?.email ?? profile?.email ?? ""}
                disabled
                readOnly
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="profile-display-name"
                className="text-xs font-medium text-muted-foreground"
              >
                표시 이름
              </label>
              <Input
                id="profile-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="홍길동"
                disabled={disabled}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="profile-phone"
                className="text-xs font-medium text-muted-foreground"
              >
                연락처 <span className="text-red-600">*</span>
              </label>
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="010-0000-0000"
                disabled={disabled}
                inputMode="tel"
                autoComplete="tel"
                required
              />
            </div>
          </>
        )}
        {feedback ? (
          <p
            className={
              feedback.kind === "ok"
                ? "text-xs text-emerald-600"
                : "text-xs text-red-700"
            }
          >
            {feedback.text}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-border pt-4">
        <LogoutButton />
        <Button
          type="button"
          variant="accent"
          disabled={disabled}
          onClick={() => void handleSave()}
        >
          {saving ? "저장 중..." : "저장"}
        </Button>
      </CardFooter>
    </Card>
  );
}
