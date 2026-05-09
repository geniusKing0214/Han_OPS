"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AccountSummary() {
  const { user, profile, loading } = useAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">계정 (Firebase)</CardTitle>
        <CardDescription>Auth · Firestore users 문서</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {loading ? (
          <p className="text-muted-foreground">불러오는 중...</p>
        ) : (
          <>
            <p className="text-muted-foreground">
              이메일 ·{" "}
              <span className="text-foreground">
                {user?.email ?? profile?.email ?? "—"}
              </span>
            </p>
            {profile?.displayName ? (
              <p className="text-muted-foreground">
                표시 이름 ·{" "}
                <span className="text-foreground">{profile.displayName}</span>
              </p>
            ) : null}
            {profile?.phone ? (
              <p className="text-muted-foreground">
                연락처 ·{" "}
                <span className="text-foreground">{profile.phone}</span>
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">역할</span>
              <Badge variant={profile?.role === "admin" ? "accent" : "outline"}>
                {profile?.role === "admin" ? "관리자" : "일반"}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
