export type TrainingApplicant = {
  uid: string;
  name: string;
  appliedAt: string;
};

export type TrainingStatus = "open" | "closed";
export type TrainingCloseReason = "capacity" | "manual";

export type TrainingItem = {
  id: string;
  title: string;
  location: string;
  /** 교육 일시 (YYYY-MM-DDTHH:mm) */
  startAt: string;
  content: string;
  capacity: number;
  applicants: TrainingApplicant[];
  status: TrainingStatus;
  closeReason?: TrainingCloseReason;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};
