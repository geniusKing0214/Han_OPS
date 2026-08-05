"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#F7F7F5] px-4 text-center text-[#14161C]">
        <h1 className="text-lg font-semibold">화면을 불러오지 못했습니다</h1>
        <p className="max-w-md text-sm text-[#14161C]/70">
          {error.message || "일시적인 오류입니다. 새로고침 후 다시 시도해 주세요."}
        </p>
        <button
          type="button"
          className="rounded-xl bg-[#B8863E] px-4 py-2 text-sm font-medium text-white"
          onClick={() => reset()}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
