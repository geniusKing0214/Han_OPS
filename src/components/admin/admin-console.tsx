"use client";

import { useEffect, useMemo, useState } from "react";

import type { ApplicationItem } from "@/types/application";
import {
  adminApproveCancelRequest,
  adminRejectCancelRequest,
  decideApplication,
} from "@/lib/firestore-applications";
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
  cancelRequestedApplications = [],
  cancelRequestedLoading,
}: {
  pendingApplications: ApplicationItem[];
  loading?: boolean;
  cancelRequestedApplications?: ApplicationItem[];
  cancelRequestedLoading?: boolean;
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
        [...pendingApplications, ...cancelRequestedApplications]
          .map((a) => a.userId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    return ids.sort().join("|");
  }, [pendingApplications, cancelRequestedApplications]);

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

  const handleApproveCancel = async (id: string) => {
    setLocalError("");
    setBusyId(id);
    try {
      await adminApproveCancelRequest(id);
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "취소 승인에 실패했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectCancel = async (id: string) => {
    setLocalError("");
    setBusyId(id);
    try {
      await adminRejectCancelRequest(id);
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "취소 거절에 실패했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {localError ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
          {localError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">취소 승인 대기</CardTitle>
          <CardDescription>
            이미 승인된 신청의 취소 요청입니다. 승인하면 정원이 반환되고,
            거절하면 그대로 근무가 유지됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {cancelRequestedLoading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : cancelRequestedApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              취소 요청이 없습니다.
            </p>
          ) : (
            cancelRequestedApplications.map((a) => {
              const { nickname, email } = resolveApplicant(a, profiles);
              return (
                <div
                  key={a.id}
                  className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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
                    {a.positionLabel ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent ring-1 ring-accent/30">
                          {a.positionLabel}
                        </span>
                        {a.positionSlotTime ? (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {a.positionSlotTime}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <Badge variant="destructive" className="mt-2">
                      취소 요청
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-500/10"
                      disabled={busyId === a.id}
                      onClick={() => void handleApproveCancel(a.id)}
                    >
                      취소 승인
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                      disabled={busyId === a.id}
                      onClick={() => void handleRejectCancel(a.id)}
                    >
                      취소 거절(계속 근무)
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">승인 대기 신청</CardTitle>
          <CardDescription>
            스케줄 신청이 Firestore에 저장되면 여기에서 승인·거절합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
                    {a.positionLabel ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent ring-1 ring-accent/30">
                          {a.positionLabel}
                        </span>
                        {a.positionSlotTime ? (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {a.positionSlotTime}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {a.note ? (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
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
              variant="outline"
              className="text-red-600 hover:bg-red-500/10 hover:text-red-700"
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
