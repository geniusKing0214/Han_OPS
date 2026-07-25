@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"
git add src/components/admin/event-form-dialog.tsx
git add src/components/schedule/schedule-board.tsx
git add src/components/schedule/apply-slot.tsx
git commit -m "fix: mobile capacity input + show all positions including no-slot ones"
git pull --no-rebase --no-edit origin main
git push origin main
pause
