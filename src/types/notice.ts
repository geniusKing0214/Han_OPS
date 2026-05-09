export type NoticeDoc = {
  id: string;
  title: string;
  content: string;
  author: string;
  author_uid: string;
  /** ISO 또는 표시용 문자열 — Firestore Timestamp 직렬화 시 클라이언트에서 처리 */
  created_at: string;
  updated_at: string;
  is_important: boolean;
};
