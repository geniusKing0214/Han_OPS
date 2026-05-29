"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adjustUserPoints } from "@/lib/firestore-points";
import { cn } from "@/lib/utils";

type AdminPointAdjustFormProps = {
  userId: string;
  monthKey: string;
  adminUid: string;
  onSuccess?: () => void;
};

export function AdminPointAdjustForm({
  userId,
  monthKey,
  adminUid,
  onSuccess,
}: AdminPointAdjustFormProps) {
  const [mode, setMode] = useState<"add" | "subtract">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("1 이상의 포인트를 입력해 주세요.");
      return;
    }
    if (!reason.trim()) {
      setError("조정 사유를 입력해 주세요.");
      return;
    }

    const delta = mode === "add" ? Math.trunc(value) : -Math.trunc(value);
    setSaving(true);
    setError("");
    try {
      await adjustUserPoints({
        userId,
        points: delta,
        reason: reason.trim(),
        monthKey,
        adminUid,
      });
      setAmount("");
      setReason("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "포인트 조정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-sm font-medium">포인트 수동 조정</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "add" ? "accent" : "outline"}
          className="gap-1"
          onClick={() => setMode("add")}
          disabled={saving}
        >
          <Plus className="size-3.5" />
          지급
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "subtract" ? "default" : "outline"}
          className={cn(
            mode === "subtract" &&
              "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
          )}
          onClick={() => setMode("subtract")}
          disabled={saving}
        >
          <Minus className="size-3.5" />
          차감
        </Button>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">포인트</label>
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder={mode === "add" ? "지급할 포인트" : "차감할 포인트"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={saving}
          className="tabular-nums"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">사유 (내역에 표시)</label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 이벤트 보너스, 정산 보정"
          className="min-h-[72px] resize-none text-sm"
          disabled={saving}
        />
      </div>
      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="accent"
        className="w-full"
        disabled={saving}
        onClick={() => void handleSubmit()}
      >
        {saving ? "처리 중..." : mode === "add" ? "포인트 지급" : "포인트 차감"}
      </Button>
    </div>
  );
}
