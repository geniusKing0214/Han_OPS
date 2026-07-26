import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { BambooPost } from "@/types/bamboo";

export const BAMBOO_COLLECTION = "bambooForest";
const CONTENT_SUBCOLLECTION = "detail";
const CONTENT_DOC_ID = "content";

function tsToIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

function docToBambooPost(id: string, data: Record<string, unknown>): BambooPost | null {
  const title = data.title;
  if (typeof title !== "string") return null;
  return {
    id,
    title,
    created_at: tsToIso(data.created_at),
  };
}

/** 목록 구독 — 제목만 내려온다. 본문은 관리자만 개별 조회한다. */
export function subscribeBambooPosts(
  onNext: (rows: BambooPost[]) => void,
  onError?: (msg: string) => void,
) {
  return onSnapshot(
    collection(db, BAMBOO_COLLECTION),
    (snap) => {
      const rows: BambooPost[] = [];
      for (const d of snap.docs) {
        const p = docToBambooPost(d.id, d.data() as Record<string, unknown>);
        if (p) rows.push(p);
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

/** 익명 게시물 작성 — 제목/본문 문서를 분리 저장해 본문은 관리자만 읽을 수 있게 한다. */
export async function createBambooPost(input: {
  title: string;
  content: string;
}): Promise<void> {
  const id = crypto.randomUUID();
  const batch = writeBatch(db);
  batch.set(doc(db, BAMBOO_COLLECTION, id), {
    title: input.title.trim(),
    created_at: serverTimestamp(),
  });
  batch.set(doc(db, BAMBOO_COLLECTION, id, CONTENT_SUBCOLLECTION, CONTENT_DOC_ID), {
    content: input.content.trim(),
  });
  await batch.commit();
}

/** 본문 조회 — Firestore 규칙상 관리자만 읽기가 허용된다. */
export async function fetchBambooPostContent(postId: string): Promise<string> {
  const snap = await getDoc(
    doc(db, BAMBOO_COLLECTION, postId, CONTENT_SUBCOLLECTION, CONTENT_DOC_ID),
  );
  const content = snap.data()?.content;
  return typeof content === "string" ? content : "";
}

/** 게시물 삭제 (관리자 전용) */
export async function deleteBambooPost(postId: string): Promise<void> {
  await deleteDoc(
    doc(db, BAMBOO_COLLECTION, postId, CONTENT_SUBCOLLECTION, CONTENT_DOC_ID),
  );
  await deleteDoc(doc(db, BAMBOO_COLLECTION, postId));
}
