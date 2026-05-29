import type { NoticeDoc } from "@/types/notice";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEK_STORAGE_KEY = "han-ops:notice-week-dismiss";
type WeekDismissStore = Record<string, Record<string, number>>;

function readWeekStore(): WeekDismissStore {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(WEEK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WeekDismissStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeWeekStore(store: WeekDismissStore) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(WEEK_STORAGE_KEY, JSON.stringify(store));
}

function pruneExpired(store: WeekDismissStore): WeekDismissStore {
  const now = Date.now();
  const next: WeekDismissStore = {};
  for (const [uid, notices] of Object.entries(store)) {
    const kept: Record<string, number> = {};
    for (const [noticeId, expiresAt] of Object.entries(notices)) {
      if (expiresAt > now) kept[noticeId] = expiresAt;
    }
    if (Object.keys(kept).length > 0) next[uid] = kept;
  }
  return next;
}

export function isNoticeWeekDismissed(uid: string, noticeId: string): boolean {
  const store = pruneExpired(readWeekStore());
  writeWeekStore(store);
  const expiresAt = store[uid]?.[noticeId];
  return typeof expiresAt === "number" && expiresAt > Date.now();
}

export function dismissNoticeForWeek(uid: string, noticeId: string) {
  const store = pruneExpired(readWeekStore());
  if (!store[uid]) store[uid] = {};
  store[uid][noticeId] = Date.now() + WEEK_MS;
  writeWeekStore(store);
}

/** 최신 중요 공지 중 팝업 대상 1건 (notices는 최신순 정렬 가정) */
export function findImportantNoticeToShow(
  uid: string,
  notices: NoticeDoc[],
): NoticeDoc | null {
  for (const notice of notices) {
    if (!notice.is_important) continue;
    if (isNoticeWeekDismissed(uid, notice.id)) continue;
    return notice;
  }
  return null;
}
