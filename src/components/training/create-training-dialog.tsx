"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type CreateTrainingInput = {
  title: string;
  location: string;
  date: string;
  time: string;
  content: string;
  capacity: number;
};

export function CreateTrainingDialog({
  open,
  onOpenChange,
  onCreate,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateTrainingInput) => Promise<void>;
  defaultDate?: string;
}) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(defaultDate ?? "");
  const [time, setTime] = useState("19:00");
  const [content, setContent] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setTitle("");
    setLocation("");
    setDate(defaultDate ?? "");
    setTime("19:00");
    setContent("");
    setCapacity("10");
    setError("");
  };

  const handleSubmit = async () => {
    if (!title.trim() || !location.trim() || !date || !time) {
      setError("교육제목·장소·날짜·시간은 필수입니다.");
      return;
    }
    const cap = Math.max(1, Number.parseInt(capacity, 10) || 0);
    setSaving(true);
    setError("");
    try {
      await onCreate({ title, location, date, time, content, capacity: cap });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>교육 생성</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">교육제목</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 신규 딜러 교육"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">장소</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 강남 센터 3층"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">날짜</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">시간</label>
              <Input
                type="time"
                step={60}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">교육내용</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="교육 내용을 적어주세요"
              className="min-h-[88px]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">정원</label>
            <Input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-24"
            />
          </div>
          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="button" variant="accent" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? "생성 중..." : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
