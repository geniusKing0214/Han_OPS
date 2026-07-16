"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h2 className="text-base font-semibold">페이지 오류</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        일시적인 오류가 발생했습니다. 캐시된 이전 배포와 충돌했을 수 있습니다.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="accent" onClick={() => reset()}>
          다시 시도
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
        >
          새로고침
        </Button>
      </div>
    </div>
  );
}
