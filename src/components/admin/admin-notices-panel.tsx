"use client";

import { useEffect, useState } from "react";
import { Bell, Pencil, Plus, Send, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/providers/auth-provider";
import {
  createAdminNotice,
  deleteAdminNotice,
  subscribeAdminNotices,
  updateAdminNotice,
  type AdminNotice,
  type AdminNoticeType,
} from "@/lib/firestore-notifications";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: AdminNoticeType[] = ["일반", "중요", "공지"];

const typeBadgeClass: Record<AdminNoticeType, string> = {
  일반: "bg-muted text-muted-foreground",
  중요: "bg-amber-500/20 text-amber-300",
  공지: "bg-accent/20 text-accent",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

type FormState = {
  title: string;
  message: string;
  type: AdminNoticeType;
  scheduledDate: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  message: "",
  type: "일반",
  scheduledDate: today(),
};

export function AdminNoticesPanel() {
  const { user } = useAuth();

  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 다이얼로그 상태
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminNotice | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<AdminNotice | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(
    () =>
      subscribeAdminNotices(
        (items) => {
          setNotices(items);
          setLoading(false);
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
      ),
    [],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setOpen(true);
  };

  const openEdit = (notice: AdminNotice) => {
    setEditing(notice);
    setForm({
      title: notice.title,
      message: notice.message,
      type: notice.type,
      scheduledDate: notice.scheduledDate,
    });
    setFormError("");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError("제목을 입력하세요.");
      return;
    }
    if (!form.message.trim()) {
      setFormError("내용을 입력하세요.");
      return;
    }
    if (!form.scheduledDate) {
      setFormError("날짜를 선택하세요.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await updateAdminNotice(editing.id, {
          title: form.title.trim(),
          message: form.message.trim(),
          type: form.type,
          scheduledDate: form.scheduledDate,
        });
      } else {
        await createAdminNotice({
          title: form.title.trim(),
          message: form.message.trim(),
          type: form.type,
          scheduledDate: form.scheduledDate,
          createdBy: user?.uid ?? "",
          createdByName: user?.displayName ?? user?.email ?? "",
        });
      }
      setOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminNotice(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const formatSentAt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="알림 발송"
        description="전체 멤버에게 공지 알림을 보냅니다. 발송 즉시 앱 알림에 표시됩니다."
      />

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          새 알림 작성
        </Button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          불러오는 중…
        </p>
      ) : notices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              발송된 알림이 없습니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <Card key={notice.id} className="transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          typeBadgeClass[notice.type],
                        )}
                      >
                        {notice.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatSentAt(notice.sentAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {notice.recipientCount}명 수신
                      </span>
                    </div>
                    <CardTitle className="text-base">{notice.title}</CardTitle>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(notice)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(notice)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {notice.message}
                </p>
                <p className="mt-2 text-xs text-muted-foreground/60">
                  예정일: {notice.scheduledDate} · 작성자: {notice.createdByName}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 작성/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "알림 수정" : "새 알림 작성"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 알림 종류 */}
            <div className="space-y-1.5">
              <Label>알림 종류</Label>
              <div className="flex gap-2">
                {TYPE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                      form.type === t
                        ? "border-accent bg-accent/20 text-accent"
                        : "border-border text-muted-foreground hover:border-accent/40",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 날짜 */}
            <div className="space-y-1.5">
              <Label htmlFor="notice-date">날짜</Label>
              <Input
                id="notice-date"
                type="date"
                value={form.scheduledDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scheduledDate: e.target.value }))
                }
              />
            </div>

            {/* 제목 */}
            <div className="space-y-1.5">
              <Label htmlFor="notice-title">제목</Label>
              <Input
                id="notice-title"
                placeholder="알림 제목을 입력하세요"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                maxLength={80}
              />
            </div>

            {/* 내용 */}
            <div className="space-y-1.5">
              <Label htmlFor="notice-message">내용</Label>
              <Textarea
                id="notice-message"
                placeholder="알림 내용을 입력하세요"
                value={form.message}
                onChange={(e) =>
                  setForm((f) => ({ ...f, message: e.target.value }))
                }
                rows={4}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-right text-xs text-muted-foreground">
                {form.message.length}/500
              </p>
            </div>

            {formError ? (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {formError}
              </p>
            ) : null}

            {!editing ? (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                발송 즉시 승인된 전체 멤버의 알림함에 표시됩니다.
              </p>
            ) : (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                수정은 이 기록만 변경합니다. 이미 발송된 알림은 변경되지 않습니다.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                취소
              </Button>
              <Button
                type="button"
                className="flex-1 gap-2"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                <Send className="size-4" />
                {saving
                  ? "처리 중…"
                  : editing
                    ? "수정 저장"
                    : "전체 발송"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <DialogContent className="sm:max-w-sm sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>알림 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              &ldquo;{deleteTarget?.title}&rdquo;
            </span>{" "}
            공지를 삭제하면 발송 이력이 제거됩니다.
            <br />
            이미 수신된 알림은 유저 알림함에 남아 있습니다.
          </p>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "삭제 중…" : "삭제"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
