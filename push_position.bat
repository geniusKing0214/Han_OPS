@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"

echo === Removing lock file if exists ===
if exist ".git\index.lock" del /f ".git\index.lock"

echo === Stage modified src files ===
git add src/types/schedule.ts
git add src/types/application.ts
git add src/types/workforce.ts
git add src/lib/firestore-events.ts
git add src/lib/firestore-applications.ts
git add src/lib/firestore-workforce.ts
git add src/components/admin/event-form-dialog.tsx
git add src/components/schedule/apply-slot.tsx
git add src/components/schedule/schedule-board.tsx
git add src/components/admin/workforce/workforce-scheduler-panel.tsx

echo === Commit ===
git commit -m "feat: position-based scheduling for events and workforce"

echo === Pull remote changes ===
git pull --no-rebase --no-edit origin main

echo === Push ===
git push origin main

echo.
echo === Done! ===
pause
