"use client";

import { AdminConsole } from "@/components/admin/admin-console";
import { usePendingApplicationsAdmin } from "@/hooks/use-pending-applications-admin";

export default function AdminApplicationsPage() {
  const { pending, loading, error } = usePendingApplicationsAdmin();

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}
      <AdminConsole pendingApplications={pending} loading={loading} />
    </div>
  );
}
