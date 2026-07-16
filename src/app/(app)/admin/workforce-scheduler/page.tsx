"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 어드민 셸 밖 독립 페이지로 이동 */
export default function AdminWorkforceSchedulerRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/workforce-scheduler");
  }, [router]);

  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      인력 배치 스케줄러로 이동 중…
    </p>
  );
}
