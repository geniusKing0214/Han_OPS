@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"
git add src/components/admin/workforce/workforce-scheduler-panel.tsx
git commit -m "fix: pass applications prop to ScheduleCard for positionSlotTime display"
git pull --no-rebase --no-edit origin main
git push origin main
pause
