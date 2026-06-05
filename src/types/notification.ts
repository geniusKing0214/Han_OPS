export type NotificationType =
  | "application_submitted"
  | "application_approved"
  | "application_rejected"
  | "schedule_created";

export type NotificationTargetRole = "admin" | "member";

export type NotificationItem = {
  id: string;
  targetUserId: string;
  targetEmail?: string;
  targetRole: NotificationTargetRole;
  type: NotificationType;
  title: string;
  message: string;
  eventId?: string;
  applicationId?: string;
  eventTitle: string;
  eventDate: string;
  slotTime: string;
  location: string;
  applicantName?: string;
  applicantEmail?: string;
  rejectionReason?: string;
  createdByUserId?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  application_submitted: "신청",
  application_approved: "승인",
  application_rejected: "거절",
  schedule_created: "스케줄",
};

export const notificationStatusBadgeVariant: Record<
  NotificationType,
  "warning" | "success" | "destructive" | "accent"
> = {
  application_submitted: "warning",
  application_approved: "success",
  application_rejected: "destructive",
  schedule_created: "accent",
};
