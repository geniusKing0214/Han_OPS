"use client";

import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { useBambooPosts } from "@/hooks/use-bamboo-posts";
import {
  createBambooPost,
  deleteBambooPost,
  fetchBambooPostDetail,
  saveBambooPostAnswer,
} from "@/lib/firestore-bamboo";
import { BAMBOO_DEFAULT_TITLE } from "@/types/bamboo";
import type { BambooPostContent } from "@/types/bamboo";

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

export function BambooForestView() {
  const { isAdmin } = useAuth();
  const { rows, loading, error } = useBambooPosts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formTitle, setFormTitle] = useState(BAMBOO_DEFAULT_TITLE);
  const [formContent, setFormContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [detailById, setDetailById] = useState<Record<string, BambooPostContent>>(
    {},
  );
  const [answerDraftById, setAnswerDraftById] = useState<Record<string, string>>(
    {},
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);

  const openCreate = () => {
    setFormTitle(BAMBOO_DEFAULT_TITLE);
    setFormContent("");
    setSubmitError("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSaving(true);
    setSubmitError("");
    try {
      await createBambooPost({ title: formTitle, content: formContent });
      setDialogOpen(false);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "등록에 실패했습니다. 다시 시도해주세요.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleOpen = async (id: string) => {
    if (!isAdmin) return;
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (!(id in detailById)) {
      setLoadingId(id);
      try {
        const detail = await fetchBambooPostDetail(id);
        setDetailById((prev) => ({ ...prev, [id]: detail }));
        setAnswerDraftById((prev) =>
          id in prev ? prev : { ...prev, [id]: detail.answer ?? "" },
        );
      } finally {
        setLoadingId(null);
      }
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!isAdmin) return;
    if (!confirm(`"${title}" 게시물을 삭제할까요? 복구할 수 없습니다.`)) return;
    setDeletingId(id);
    try {
      await deleteBambooPost(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveAnswer = async (id: string) => {
    const answer = (answerDraftById[id] ?? "").trim();
    if (!answer) return;
    setSavingAnswerId(id);
    try {
      await saveBambooPostAnswer(id, answer);
      setDetailById((prev) => ({
        ...prev,
        [id]: {
          content: prev[id]?.content ?? "",
          answer,
          answered_at: new Date().toISOString(),
        },
      }));
    } finally {
      setSavingAnswerId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="한대나무숲"
        description="누구나 익명으로 건의사항·고충을 남길 수 있습니다. 내용은 관리자만 확인합니다."
        actions={
          <Button type="button" variant="accent" size="sm" onClick={openCreate}>
            건의사항 작성
          </Button>
        }
      />

      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          목록을 불러오지 못했습니다: {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>건의사항 작성</DialogTitle>
            <DialogDescription>
              작성자 정보는 저장되지 않습니다. 완전히 익명으로 등록되며, 내용은
              관리자만 확인할 수 있습니다.
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
                className="min-h-[140px]"
                placeholder="관리자에게 전달하고 싶은 내용을 자유롭게 적어주세요."
              />
            </div>
            {submitError ? (
              <p className="text-xs text-red-700">{submitError}</p>
            ) : null}
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
              disabled={saving || !formTitle.trim() || !formContent.trim()}
              onClick={() => void handleSubmit()}
            >
              {saving ? "등록 중..." : "익명으로 등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {!loading && rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
            등록된 건의사항이 없습니다. 「건의사항 작성」으로 남겨보세요.
          </p>
        ) : null}
        {rows.map((post) => {
          const expanded = isAdmin && openIds.has(post.id);
          return (
            <Card key={post.id} className="overflow-hidden">
              <CardHeader className="p-0">
                <button
                  type="button"
                  onClick={() => void toggleOpen(post.id)}
                  disabled={!isAdmin}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:cursor-not-allowed"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {post.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {formatWhen(post.created_at)}
                    </p>
                  </div>
                  {isAdmin ? (
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="size-3.5" />
                      관리자 전용
                    </span>
                  )}
                </button>
              </CardHeader>
              {expanded ? (
                <CardContent className="space-y-4 border-t border-border pt-3">
                  {loadingId === post.id && !(post.id in detailById) ? (
                    <p className="text-sm text-muted-foreground">불러오는 중...</p>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {detailById[post.id]?.content ?? ""}
                    </p>
                  )}

                  <div className="space-y-2 border-t border-border pt-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      관리자 답변
                      {detailById[post.id]?.answered_at
                        ? ` · ${formatWhen(detailById[post.id]!.answered_at!)} 저장됨`
                        : " (작성자에게는 노출되지 않는 내부 기록입니다)"}
                    </label>
                    <Textarea
                      value={answerDraftById[post.id] ?? ""}
                      onChange={(e) =>
                        setAnswerDraftById((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      className="min-h-[80px]"
                      placeholder="이 건의사항에 대한 답변을 남겨보세요."
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        disabled={
                          savingAnswerId === post.id ||
                          !(answerDraftById[post.id] ?? "").trim()
                        }
                        onClick={() => void handleSaveAnswer(post.id)}
                      >
                        {savingAnswerId === post.id ? "저장 중..." : "답변 저장"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-500/10"
                      disabled={deletingId === post.id}
                      onClick={() => void handleDelete(post.id, post.title)}
                    >
                      {deletingId === post.id ? "삭제 중..." : "삭제"}
                    </Button>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
