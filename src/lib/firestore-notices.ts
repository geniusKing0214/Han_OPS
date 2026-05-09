import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { NoticeDoc } from "@/types/notice";

export const NOTICES_COLLECTION = "notices";

function tsToIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

function docToNotice(id: string, data: Record<string, unknown>): NoticeDoc | null {
  const title = data.title;
  const content = data.content;
  const author = data.author;
  const author_uid = data.author_uid;
  if (typeof title !== "string" || typeof content !== "string") {
    return null;
  }
  const is_important = Boolean(data.is_important);
  return {
    id,
    title,
    content,
    author: typeof author === "string" ? author : "관리자",
    author_uid: typeof author_uid === "string" ? author_uid : "",
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
    is_important,
  };
}

export function subscribeNotices(
  onNext: (rows: NoticeDoc[]) => void,
  onError?: (msg: string) => void,
) {
  return onSnapshot(
    collection(db, NOTICES_COLLECTION),
    (snap) => {
      const rows: NoticeDoc[] = [];
      for (const d of snap.docs) {
        const n = docToNotice(d.id, d.data() as Record<string, unknown>);
        if (n) rows.push(n);
      }
      rows.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      onNext(rows);
    },
    (e) => onError?.(e.message),
  );
}

export async function saveNotice(input: {
  id?: string;
  title: string;
  content: string;
  author: string;
  author_uid: string;
  is_important: boolean;
}): Promise<string> {
  const id = input.id ?? crypto.randomUUID();
  const ref = doc(db, NOTICES_COLLECTION, id);
  const existingSnap = await getDoc(ref);
  const createdAt =
    existingSnap.exists() && existingSnap.data()?.created_at != null
      ? existingSnap.data()!.created_at
      : serverTimestamp();

  await setDoc(ref, {
    title: input.title.trim(),
    content: input.content.trim(),
    author: input.author.trim(),
    author_uid: input.author_uid,
    is_important: input.is_important,
    created_at: createdAt,
    updated_at: serverTimestamp(),
  });

  return id;
}

export async function deleteNotice(id: string): Promise<void> {
  await deleteDoc(doc(db, NOTICES_COLLECTION, id));
}
