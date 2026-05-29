export type NoticeItem = {

  id: string;

  title: string;

  body: string;

  createdAt: string;

  priority: "normal" | "high";

};



/** 빈 배열 — 공지는 Firestore(관리자 작성) 또는 별도 연동 */

export const mockNotices: NoticeItem[] = [];



export const mockAdminAlerts: { id: string; message: string; tone: "warning" | "neutral" }[] =

  [];

