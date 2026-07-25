@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"

echo === Removing lock file if exists ===
if exist ".git\index.lock" del /f ".git\index.lock"

echo === Stage modified files ===
git add src/lib/schedule-mutations.ts
git add src/components/admin/session-schedule-sheet-body.tsx
git add src/components/applications/my-application-row.tsx
git add src/components/admin/application-roster-panel.tsx

echo === Commit ===
git commit -m "fix: position edit/display - edit form positions, apply label in roster"

echo === Pull remote changes ===
git pull --no-rebase --no-edit origin main

echo === Push ===
git push origin main

echo.
echo === Done! ===
pause
