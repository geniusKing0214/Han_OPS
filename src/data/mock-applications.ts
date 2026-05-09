/** 호환용 재내보내기 · 신청 데이터는 Firestore `applications` 및 hooks 참고 */
export type { ApplicationStatus, ApplicationItem } from "@/types/application";
export { statusLabels } from "@/types/application";

import type { ApplicationItem } from "@/types/application";

export const mockApplications: ApplicationItem[] = [];
