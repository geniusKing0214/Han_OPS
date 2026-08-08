"use client";

import { ActivityLogPanel } from "@/components/admin/activity-log-panel";
import { AdminRouteGuard } from "@/components/auth/admin-route-guard";

export default function LogsPage() {
  return (
    <AdminRouteGuard>
      <ActivityLogPanel />
    </AdminRouteGuard>
  );
}
