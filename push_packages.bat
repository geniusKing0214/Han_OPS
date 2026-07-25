@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"
git add src/types/schedule.ts src/types/application.ts src/types/monthly-sheet.ts
git add src/lib/firestore-events.ts src/lib/firestore-applications.ts src/lib/monthly-sheet-aggregator.ts
git add src/components/admin/event-form-dialog.tsx
git add src/components/schedule/schedule-board.tsx src/components/schedule/apply-slot.tsx
git add src/components/monthly-sheet/monthly-sheet-day-detail.tsx
git commit -m "feat: 기간 패키지 신청 + 신청 차단 버그 수정"
git pull --no-rebase --no-edit origin main
git push origin main
pause
