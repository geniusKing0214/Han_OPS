"use client";

import { useEffect, useMemo, useState } from "react";

import type { ApplicationItem } from "@/types/application";
import { decideApplication } from "@/lib/firestore-applications";
import { getUserProfilesByIds } from "@/lib/firestore-users";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { statusLabels } from "@/types/application";

type ApplicantResolved = { nickname: string; email: string };

function resolveApplicant(
  a: ApplicationItem,
  profiles: Map<string, { email: string; displayName: string }>,
): ApplicantResolved {
  const p = a.userId ? profiles.get(a.userId) : undefined;
  const nickname =
    a.applicantDisplayName?.trim() || p?.displayName?.trim() || "";
  const email = a.applicantEmail?.trim() || p?.email?.trim() || "";
  return { nickname, email };
}

export function AdminConsole({
  pendingApplications,
  loading,
}: {
  pendingApplications: ApplicationItem[];
  loading?: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [profiles, setProfiles] = useState<
    Map<string, { email: string; displayName: string }>
  >(() => new Map());
  const [rejectTarget, setRejectTarget] = useState<ApplicationItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const userIdsKey = useMemo(() => {
    const ids = [
      ...new Set(
        pendingApplications
          .map((a) => a.userId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    return ids.sort().join("|");
  }, [pendingApplications]);

  useEffect(() => {
    const ids = userIdsKey
      ? userIdsKey.split("|").filter(Boolean)
      : [];
    if (ids.length === 0) {
      setProfiles(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const m = await getUserProfilesByIds(ids);
        if (!cancelled) setProfiles(m);
      } catch {
        if (!cancelled) setProfiles(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userIdsKey]);

  const setStatus = async (
    id: string,
    status: "approved" | "rejected",
    rejectionReason?: string,
  ) => {
    setLocalError("");
    setBusyId(id);
    try {
      await decideApplication(id, status, {
        rejectionReason: rejectionReason?.trim() || undefined,
      });
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "상태 변경에 실패했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    await setStatus(rejectTarget.id, "rejected", rejectReason);
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">승인 대기 신청</CardTitle>
          <CardDescription>
            스케줄 신청이 Firestore에 저장되면 여기에서 승인·거절합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {localError ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {localError}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : pendingApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              대기 중인 신청이 없습니다.
            </p>
          ) : (
            pendingApplications.map((a) => {
              const { nickname, email } = resolveApplicant(a, profiles);
              return (
                <div
                  key={a.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{a.eventTitle}</p>
                    <div className="mt-1 space-y-0.5 text-sm">
                      <p>
                        <span className="text-muted-foreground">닉네임</span>{" "}
                        <span className="text-foreground">
                          {nickname || "—"}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">이메일</span>{" "}
                        <span className="break-all text-foreground">
                          {email || "—"}
                        </span>
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {a.venue} ·{" "}
                      <span className="tabular-nums">
                        {a.date} {a.slotTime}
                      </span>
                    </p>
                    {a.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        메모: {a.note}
                      </p>
                    ) : null}
                    <Badge variant="warning" className="mt-2">
                      {statusLabels[a.status]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={busyId === a.id}
                      onClick={() => void setStatus(a.id, "approved")}
                    >
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === a.id}
                      onClick={() => {
                        setRejectTarget(a);
                        setRejectReason("");
                      }}
                    >
                      거절
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신청 거절</DialogTitle>
            <DialogDescription>
              거절 사유를 입력하면 신청자 알림에 함께 표시됩니다. (선택)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="거절 사유 (선택)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busyId === rejectTarget?.id}
              onClick={() => void confirmReject()}
            >
              거절 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
