# 인력 배정 스케줄러

관리자가 주간 단위로 근무자를 **직접 배정**하는 기능입니다.  
기존 스케줄 신청(`events` / `applications`)과 **완전히 분리**된 컬렉션을 사용합니다.

## URL

| 역할 | 경로 |
|------|------|
| 관리자 | `/admin/workforce-scheduler` |
| 멤버 | `/my-assignments` (확정분만 조회) |

## Firestore 컬렉션

| 컬렉션 | 용도 |
|--------|------|
| `workforceWeeks/{weekStart}` | 주간 meta (`draft` / `confirmed`) |
| `workforceSchedules` | 일정 + `assignedUserIds` |
| `workforceAvailability/{userId}` | 가능 요일 · 날짜 예외 · 주간 최대 횟수 |
| `workforceLogs` | 배정/수정/확정 작업 이력 |
| `workforceMonthlyExports` | 「취합표로 보내기」 스냅샷 |

## 배포 시 필요

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project han-ops
```

포지션(직무) 필드는 사용하지 않습니다.
