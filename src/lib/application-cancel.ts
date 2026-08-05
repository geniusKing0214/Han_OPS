import type { ApplicationItem, ApplicationStatus } from "@/types/application";

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function canUserCancelApplication(app: ApplicationItem): boolean {
  if (app.status === "completed") return false;
  if (app.status === "pending" || app.status === "rejected") return true;
  if (app.status === "approved") {
    if (app.cancelRequestedAt) return false;
    return app.date >= todayYmd();
  }
  return false;
}

export function cancelApplicationHint(app: ApplicationItem): string | null {
  if (app.status === "pending") {
    return "대기 중인 신청을 취소하면 목록에서 삭제됩니다.";
  }
  if (app.status === "approved") {
    if (app.date === todayYmd()) {
      return "승인된 일정의 취소를 요청하면 관리자 승인 후 정원이 열립니다. 당일 취소는 운영 정책에 따라 포인트가 반영될 수 있습니다.";
    }
    return "승인된 일정의 취소를 요청하면 관리자가 승인한 뒤 정원이 열리며, 같은 이벤트에 다시 신청할 수 있습니다.";
  }
  if (app.status === "rejected") {
    return "거절된 신청을 삭제하면 목록에서 제거됩니다.";
  }
  return null;
}

export function cancelActionLabel(status: ApplicationStatus): string {
  return status === "rejected" ? "삭제" : "취소";
}

/** 승인된 신청만 "요청" 절차를 거친다 — 대기/거절 신청은 바로 삭제되므로 그대로 "취소" */
export function cancelActionVerb(status: ApplicationStatus): string {
  return status === "approved" ? "취소 요청" : "취소";
}
