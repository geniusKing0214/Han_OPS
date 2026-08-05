"use client";

import { ApprovalCalendarBoard } from "@/components/admin/approval-calendar/approval-calendar-board";
import { AdminRouteGuard } from "@/components/auth/admin-route-guard";

export default function ApprovalCalendarPage() {
  return (
    <AdminRouteGuard>
      <ApprovalCalendarBoard />
    </AdminRouteGuard>
  );
}
