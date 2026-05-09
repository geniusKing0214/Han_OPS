"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { updateOwnProfile } from "@/lib/firestore-users";
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
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setPhone(profile.phone ?? "");
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setFeedback(null);
    try {
      await updateOwnProfile(user.uid, { displayName, phone });
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
        <CardTitle className="text-base">프로필</CardTitle>
        <CardDescription>표시 이름 및 연락처</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : (
          <>
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
                연락처
              </label>
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                disabled={disabled}
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          </>
        )}
        {feedback ? (
          <p
            className={
              feedback.kind === "ok"
                ? "text-xs text-emerald-400"
                : "text-xs text-red-300"
            }
          >
            {feedback.text}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="justify-end border-t border-border pt-4">
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
