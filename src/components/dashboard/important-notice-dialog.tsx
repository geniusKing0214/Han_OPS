"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNotices } from "@/hooks/use-notices";
import {
  dismissNoticeForWeek,
  findImportantNoticeToShow,
} from "@/lib/notice-dismissal";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso.replace("T", " ").slice(0, 16);
  }
}

export function ImportantNoticeDialog() {
  const { user } = useAuth();
  const { rows: notices, loading } = useNotices();
  const [open, setOpen] = useState(false);
  const [activeNoticeId, setActiveNoticeId] = useState<string | null>(null);

  const noticeToShow = useMemo(() => {
    if (!user?.uid || loading) return null;
    return findImportantNoticeToShow(user.uid, notices);
  }, [user?.uid, loading, notices]);

  useEffect(() => {
    if (noticeToShow) {
      setActiveNoticeId(noticeToShow.id);
      setOpen(true);
      return;
    }
    setOpen(false);
    setActiveNoticeId(null);
  }, [noticeToShow]);

  const notice =
    notices.find((n) => n.id === activeNoticeId) ?? noticeToShow ?? null;

  const handleClose = () => {
    setOpen(false);
  };

  const handleDismissWeek = () => {
    if (!user?.uid || !notice) return;
    dismissNoticeForWeek(user.uid, notice.id);
    setOpen(false);
  };

  if (!notice) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg [&>button]:hidden">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <DialogTitle className="text-left leading-snug">
              {notice.title}
            </DialogTitle>
            <Badge variant="warning">중요</Badge>
          </div>
          <DialogDescription className="text-left">
            {formatWhen(notice.created_at)} · {notice.author}
          </DialogDescription>
        </DialogHeader>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {notice.content}
        </p>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            닫기
          </Button>
          <Button type="button" variant="accent" onClick={handleDismissWeek}>
            1주일간 닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
