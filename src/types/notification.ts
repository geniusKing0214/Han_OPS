export type NotificationType =
  | "application_submitted"
  | "application_cancelled"
  | "application_approved"
  | "application_rejected"
  | "schedule_created"
  | "schedule_cancelled"
  | "notice_posted";

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
  noticeId?: string;
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
  application_cancelled: "취소",
  application_approved: "승인",
  application_rejected: "거절",
  schedule_created: "스케줄",
  schedule_cancelled: "일정 취소",
  notice_posted: "공지",
};

export const notificationStatusBadgeVariant: Record<
  NotificationType,
  "warning" | "success" | "destructive" | "accent" | "default"
> = {
  application_submitted: "warning",
  application_cancelled: "destructive",
  application_approved: "success",
  application_rejected: "destructive",
  schedule_created: "accent",
  schedule_cancelled: "destructive",
  notice_posted: "warning",
};
