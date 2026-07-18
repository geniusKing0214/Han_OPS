"use client";

import { PageHeader } from "@/components/layout/page-header";
import { MyAvailabilityForm } from "@/components/availability/my-availability-form";

export default function MyAvailabilityPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        title="근무 가능일"
        description={
          <>
            <span className="font-medium text-accent">익주</span>만 신청할 수
            있습니다. 신청 후에는 관리자만 변경할 수 있습니다.
          </>
        }
      />
      <MyAvailabilityForm />
    </div>
  );
}
