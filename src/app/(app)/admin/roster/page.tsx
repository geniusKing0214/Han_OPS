"use client";

import { Suspense } from "react";

import { ApplicationRosterPanel } from "@/components/admin/application-roster-panel";

export default function AdminRosterPage() {
  return (
    <div className="space-y-4">
      <Suspense
        fallback={
          <p className="py-8 text-center text-sm text-muted-foreground">
            불러오는 중...
          </p>
        }
      >
        <ApplicationRosterPanel />
      </Suspense>
    </div>
  );
}
