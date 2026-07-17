"use client";

import { useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { useNotices } from "@/hooks/use-notices";
import { deleteNotice, saveNotice } from "@/lib/firestore-notices";
import type { NoticeDoc } from "@/types/notice";

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

export function NoticesView() {
  const { user, isAdmin } = useAuth();
  const { rows: fsRows, loading, error } = useNotices();

  const merged = useMemo(
    () =>
      [...fsRows].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [fsRows],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formImportant, setFormImportant] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditId(undefined);
    setFormTitle("");
    setFormContent("");
    setFormImportant(false);
    setDialogOpen(true);
  };

  const openEdit = (n: NoticeDoc) => {
    if (!isAdmin) return;
    setEditId(n.id);
    setFormTitle(n.title);
    setFormContent(n.content);
    setFormImportant(n.is_important);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formTitle.trim() || !formContent.trim()) return;
    setSaving(true);
    try {
      const existing = editId
        ? merged.find((x) => x.id === editId)
        : undefined;
      await saveNotice({
        id: editId,
        title: formTitle,
        content: formContent,
        author:
          existing?.author?.trim() || user.email?.trim() || "관리자",
        author_uid: existing?.author_uid || user.uid,
        is_important: formImportant,
      });
      setDialogOpen(false);
      setEditId(undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (n: NoticeDoc) => {
    if (!isAdmin) return;
    if (!confirm(`"${n.title}" 공지를 삭제할까요?`)) return;
    setSaving(true);
    try {
      await deleteNotice(n.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notices"
        description="운영 공지 및 정책 안내"
        actions={
          isAdmin ? (
            <Button type="button" variant="accent" size="sm" onClick={openCreate}>
              새 공지 작성
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          공지를 불러오지 못했습니다: {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "공지 수정" : "새 공지"}</DialogTitle>
            <DialogDescription>
              {editId
                ? "내용을 수정한 뒤 저장하면 반영됩니다."
                : "제목·내용은 필수입니다. 중요 공지는 상단 배지로 강조됩니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                제목
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                내용
              </label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formImportant}
                onChange={(e) => setFormImportant(e.target.checked)}
                className="rounded border-border"
              />
              중요 공지
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={
                saving || !formTitle.trim() || !formContent.trim() || !user
              }
              onClick={() => void handleSave()}
            >
              {saving
                ? "저장 중..."
                : editId
                  ? "수정 저장"
                  : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {!loading && merged.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
            등록된 공지가 없습니다.
            {isAdmin
              ? " 관리자는「새 공지 작성」으로 추가할 수 있습니다."
              : ""}
          </p>
        ) : null}
        {merged.map((n) => (
          <Card key={n.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <CardTitle className="text-base font-semibold leading-snug">
                {n.title}
              </CardTitle>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Badge variant={n.is_important ? "warning" : "outline"}>
                  {n.is_important ? "중요" : "일반"}
                </Badge>
                {isAdmin ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(n)}
                      disabled={saving}
                    >
                      수정
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-red-400 hover:bg-red-500/10"
                      onClick={() => void handleDelete(n)}
                      disabled={saving}
                    >
                      삭제
                    </Button>
                  </>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {n.content}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{n.author}</span>
                <span className="tabular-nums">
                  작성 {formatWhen(n.created_at)}
                </span>
                {Math.abs(
                  new Date(n.updated_at).getTime() -
                    new Date(n.created_at).getTime(),
                ) > 1500 ? (
                  <span className="tabular-nums">
                    수정 {formatWhen(n.updated_at)}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
