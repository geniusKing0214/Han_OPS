@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"
git add src/lib/monthly-sheet-aggregator.ts
git add src/lib/applications-match-schedule.ts
git add src/lib/firestore-workforce.ts
git commit -m "fix: position-based events in monthly sheet and workforce scheduler capacity"
git pull --no-rebase --no-edit origin main
git push origin main
pause
