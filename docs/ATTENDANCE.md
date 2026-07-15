# 출근 사진 인증 시스템

## 배포 명령어

```bash
# 웹 앱 (GitHub Pages)
git push origin main

# Firebase Rules + Storage + Functions + Indexes
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

## 환경변수

기존 Firebase `NEXT_PUBLIC_FIREBASE_*` 그대로 사용 (Storage bucket 포함).
Cloud Functions는 Firebase 프로젝트 Blaze 플랜 + Scheduler 필요.

| 변수 | 용도 |
|------|------|
| `APP_ORIGIN` | Functions 푸시 딥링크 (기존) |
| `APP_BASE_PATH` | `/Han_OPS` (기존) |

추가 클라이언트 전용 환경변수는 없음.

## 마이그레이션

- **기존 이벤트**: `attendance.attendanceEnabled` 기본 `false` → 자동 활성화 없음
- **기존 신청**: 변경 없음
- **신규 컬렉션**: `attendances`, `attendance_locks`
