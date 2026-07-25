@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"
git add src/components/monthly-sheet/monthly-sheet-day-detail.tsx
git add src/components/monthly-sheet/monthly-sheet-board.tsx
git commit -m "feat: add position-based apply button in monthly sheet day detail"
git pull --no-rebase --no-edit origin main
git push origin main
pause
