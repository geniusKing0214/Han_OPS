"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";

import {
  saveMonthlySheetDayOverride,
} from "@/lib/firestore-monthly-sheets";
import type { SheetDayBundle, SheetDayOverride, SheetEntryOverride } from "@/types/monthly-sheet";
import { TEAM_LABELS, type TeamId } from "@/types/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  dateLabel: string;
  teamId: TeamId;
  bundle: SheetDayBundle | null;
  year: number;
  month: number;
};

export function MonthlySheetDayEditor({
  open,
  onOpenChange,
  date,
  dateLabel,
  teamId,
  bundle,
  year,
  month,
}: Props) {
  const [dayColor, setDayColor] = useState("");
  const [customMemo, setCustomMemo] = useState("");
  const [manualText, setManualText] = useState("");
  const [entryEdits, setEntryEdits] = useState<
    Record<string, SheetEntryOverride>
  >({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const o = bundle?.dayOverride;
    setDayColor(o?.color ?? "");
    setCustomMemo(o?.customMemo ?? "");
    setManualText(o?.manualText ?? "");
    setEntryEdits(o?.entryOverrides ?? {});
    setError("");
  }, [open, bundle, date]);

  const updateEntry = (
    entryKey: string,
    patch: Partial<SheetEntryOverride>,
  ) => {
    setEntryEdits((prev) => ({
      ...prev,
      [entryKey]: { ...prev[entryKey], ...patch },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Firestore setDoc은 값이 undefined인 필드를 거부하므로, 비운 입력값은
      // 키 자체를 생략해야 한다 (undefined로 남겨두면 저장이 실패한다).
      const cleanedEntryEdits = Object.fromEntries(
        Object.entries(entryEdits)
          .map(([key, entry]) => [
            key,
            Object.fromEntries(
              Object.entries(entry).filter(([, v]) => v !== undefined),
            ),
          ])
          .filter(([, entry]) => Object.keys(entry).length > 0),
      ) as Record<string, SheetEntryOverride>;

      const rawOverride: SheetDayOverride = {
        color: dayColor.trim() || undefined,
        customMemo: customMemo.trim() || undefined,
        manualText: manualText.trim() || undefined,
        entryOverrides: Object.keys(cleanedEntryEdits).length
          ? cleanedEntryEdits
          : undefined,
      };
      const override = Object.fromEntries(
        Object.entries(rawOverride).filter(([, v]) => v !== undefined),
      ) as SheetDayOverride;

      const isEmpty =
        !override.color &&
        !override.customMemo &&
        !override.manualText &&
        !override.entryOverrides;

      await saveMonthlySheetDayOverride(
        year,
        month,
        teamId,
        date,
        isEmpty ? null : override,
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError("");
    try {
      await saveMonthlySheetDayOverride(year, month, teamId, date, null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{dateLabel} 편집</SheetTitle>
          <SheetDescription>
            {TEAM_LABELS[teamId]} 취합표 · 자동 데이터 위에 표시/수정 내용을
            덮어씁니다.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="day-color" className="text-sm font-medium">
              날짜 색상 태그
            </label>
            <Input
              id="day-color"
              value={dayColor}
              onChange={(e) => setDayColor(e.target.value)}
              placeholder="#D4AF37 또는 gold"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="manual-text" className="text-sm font-medium">
              표시 메모 (셀 상단)
            </label>
            <Input
              id="manual-text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="예: APL / WPL"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="custom-memo" className="text-sm font-medium">
              추가 메모
            </label>
            <Textarea
              id="custom-memo"
              value={customMemo}
              onChange={(e) => setCustomMemo(e.target.value)}
              rows={2}
            />
          </div>

          <Separator />

          <p className="text-sm font-medium">슬롯별 수정</p>
          {!bundle?.rows.length ? (
            <p className="text-xs text-muted-foreground">
              자동 집계된 슬롯이 없습니다. 위 날짜 메모만 저장할 수 있습니다.
            </p>
          ) : (
            bundle.rows.map((row) => {
              const edit = entryEdits[row.entryKey] ?? {};
              return (
                <div
                  key={row.entryKey}
                  className="space-y-2 rounded-lg border border-border p-3"
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {row.eventTitle} · {row.slotTime}
                  </p>
                  <Input
                    value={edit.eventTitle ?? ""}
                    onChange={(e) =>
                      updateEntry(row.entryKey, { eventTitle: e.target.value })
                    }
                    placeholder={`이벤트명 (기본: ${row.eventTitle})`}
                  />
                  <Input
                    value={edit.venue ?? ""}
                    onChange={(e) =>
                      updateEntry(row.entryKey, { venue: e.target.value })
                    }
                    placeholder={`장소 (기본: ${row.venue})`}
                  />
                  <Input
                    value={edit.slotTime ?? ""}
                    onChange={(e) =>
                      updateEntry(row.entryKey, { slotTime: e.target.value })
                    }
                    placeholder={`시간 (기본: ${row.slotTime})`}
                  />
                  <Input
                    type="number"
                    min={0}
                    value={edit.headcount ?? ""}
                    onChange={(e) =>
                      updateEntry(row.entryKey, {
                        headcount: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder={`인원 (기본: ${row.headcount})`}
                  />
                  <Input
                    value={edit.color ?? ""}
                    onChange={(e) =>
                      updateEntry(row.entryKey, { color: e.target.value })
                    }
                    placeholder="색상 태그"
                  />
                  <Textarea
                    value={edit.displayMemo ?? ""}
                    onChange={(e) =>
                      updateEntry(row.entryKey, { displayMemo: e.target.value })
                    }
                    placeholder="표시 메모"
                    rows={2}
                  />
                  <Textarea
                    value={edit.extraMemo ?? ""}
                    onChange={(e) =>
                      updateEntry(row.entryKey, { extraMemo: e.target.value })
                    }
                    placeholder="추가 메모"
                    rows={2}
                  />
                </div>
              );
            })
          )}

          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : null}
        </div>

        <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="accent"
            className="w-full gap-1.5"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            저장
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-1.5"
            disabled={saving}
            onClick={() => void handleClear()}
          >
            <Trash2 className="size-4" />
            이 날짜 수정 내용 초기화
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
