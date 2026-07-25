@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"
git add src/components/admin/application-roster-panel.tsx src/components/admin/event-form-dialog.tsx src/components/admin/session-schedule-sheet-body.tsx src/components/admin/workforce/workforce-scheduler-panel.tsx src/components/applications/my-application-row.tsx src/components/schedule/apply-slot.tsx src/components/schedule/schedule-board.tsx src/lib/firestore-applications.ts src/lib/firestore-events.ts src/types/application.ts src/types/schedule.ts
git commit -m "feat: Option B - position+time slot based scheduling"
git pull --no-rebase --no-edit origin main
git push origin main
pause
