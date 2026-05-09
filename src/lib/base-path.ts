/**
 * GitHub Pages 등 서브 경로 배포 시 `NEXT_PUBLIC_BASE_PATH=/Han_OPS` 와 같이 설정합니다.
 * `next.config` 의 `basePath` 와 동일한 값이어야 합니다.
 */
export function withBasePath(path: string): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
  const base = raw.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
