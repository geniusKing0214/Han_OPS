@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"
git add src/components/admin/event-form-dialog.tsx
git add src/components/admin/session-schedule-sheet-body.tsx
git commit -m "feat: remove slot time/capacity from date section, position as primary"
git pull --no-rebase --no-edit origin main
git push origin main
pause
