/** 대나무숲 게시물 — 목록에 표시되는 부분 (익명, 제목만) */
export type BambooPost = {
  id: string;
  title: string;
  /** ISO 문자열 — Firestore Timestamp 직렬화 시 클라이언트에서 처리 */
  created_at: string;
};

/** 대나무숲 게시물 본문 — 관리자만 읽을 수 있는 서브컬렉션 문서 */
export type BambooPostContent = {
  content: string;
  /** 관리자가 남긴 답변 (내부 기록용, 작성자에게는 노출되지 않음) */
  answer?: string;
  /** ISO 문자열 */
  answered_at?: string;
};

export const BAMBOO_DEFAULT_TITLE = "건의사항";
