import {
  type FirestoreError,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { assertAdmin } from "@/lib/admin-access";
import { db } from "@/lib/firebase";
import type {
  MonthlySheetDoc,
  SheetDayOverride,
} from "@/types/monthly-sheet";
import { monthlySheetDocId } from "@/types/monthly-sheet";
import type { TeamId } from "@/types/team";

export const MONTHLY_SHEETS_COLLECTION = "monthlySheets";

function docToMonthlySheet(data: Record<string, unknown>): MonthlySheetDoc {
  return {
    year: typeof data.year === "number" ? data.year : 0,
    month: typeof data.month === "number" ? data.month : 0,
    teamId:
      data.teamId === "team_2" ? "team_2" : ("team_1" as TeamId),
    adminMemo:
      typeof data.adminMemo === "string" ? data.adminMemo : undefined,
    dayOverrides:
      data.dayOverrides && typeof data.dayOverrides === "object"
        ? (data.dayOverrides as Record<string, SheetDayOverride>)
        : undefined,
    updatedAt: data.updatedAt,
  };
}

export function subscribeMonthlySheet(
  year: number,
  month: number,
  teamId: TeamId,
  onData: (doc: MonthlySheetDoc | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  const id = monthlySheetDocId(year, month, teamId);
  const ref = doc(db, MONTHLY_SHEETS_COLLECTION, id);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(docToMonthlySheet(snap.data() as Record<string, unknown>));
    },
    (err) => onError?.(err),
  );
}

export async function saveMonthlySheetAdminMemo(
  year: number,
  month: number,
  teamId: TeamId,
  adminMemo: string,
) {
  await assertAdmin();
  const id = monthlySheetDocId(year, month, teamId);
  const ref = doc(db, MONTHLY_SHEETS_COLLECTION, id);
  await setDoc(
    ref,
    {
      year,
      month,
      teamId,
      adminMemo,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearMonthlySheetEntryOverride(
  year: number,
  month: number,
  teamId: TeamId,
  date: string,
  entryKey: string,
) {
  await assertAdmin();
  const id = monthlySheetDocId(year, month, teamId);
  const ref = doc(db, MONTHLY_SHEETS_COLLECTION, id);
  await updateDoc(ref, {
    [`dayOverrides.${date}.entryOverrides.${entryKey}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
