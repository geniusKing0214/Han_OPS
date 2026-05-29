import type { NoticeDoc } from "@/types/notice";

const DISMISS_MS = 24 * 60 * 60 * 1000;
const DISMISS_STORAGE_KEY = "han-ops:notice-week-dismiss";
type DismissStore = Record<string, Record<string, number>>;

function readDismissStore(): DismissStore {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDismissStore(store: DismissStore) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(store));
}

function pruneExpired(store: DismissStore): DismissStore {
  const now = Date.now();
  const next: DismissStore = {};
  for (const [uid, notices] of Object.entries(store)) {
    const kept: Record<string, number> = {};
    for (const [noticeId, expiresAt] of Object.entries(notices)) {
      if (expiresAt > now) kept[noticeId] = expiresAt;
    }
    if (Object.keys(kept).length > 0) next[uid] = kept;
  }
  return next;
}

export function isNoticeDismissed(uid: string, noticeId: string): boolean {
  const store = pruneExpired(readDismissStore());
  writeDismissStore(store);
  const expiresAt = store[uid]?.[noticeId];
  return typeof expiresAt === "number" && expiresAt > Date.now();
}

export function dismissNoticeFor24Hours(uid: string, noticeId: string) {
  const store = pruneExpired(readDismissStore());
  if (!store[uid]) store[uid] = {};
  store[uid][noticeId] = Date.now() + DISMISS_MS;
  writeDismissStore(store);
}

/** 최신 중요 공지 중 팝업 대상 1건 (notices는 최신순 정렬 가정) */
export function findImportantNoticeToShow(
  uid: string,
  notices: NoticeDoc[],
): NoticeDoc | null {
  for (const notice of notices) {
    if (!notice.is_important) continue;
    if (isNoticeDismissed(uid, notice.id)) continue;
    return notice;
  }
  return null;
}
