"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MyAvailabilityForm } from "@/components/availability/my-availability-form";

type MyAvailabilityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAvailableCountChange?: (count: number) => void;
};

export function MyAvailabilityDialog({
  open,
  onOpenChange,
  onAvailableCountChange,
}: MyAvailabilityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 text-left">
          <DialogTitle>근무 가능일</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-accent">익주</span>만 신청할 수
            있습니다. 신청 후에는 관리자만 변경할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {open ? (
            <MyAvailabilityForm
              compact
              onAvailableCountChange={onAvailableCountChange}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
