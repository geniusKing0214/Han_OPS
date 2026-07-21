@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
echo === Abort any stuck merge ===
git merge --abort 2>nul
echo.
echo === Status ===
git status
echo.
echo === Add 3 files ===
git add src/components/monthly-sheet/monthly-sheet-calendar-grid.tsx
git add src/components/monthly-sheet/monthly-sheet-day-detail.tsx
git add src/components/monthly-sheet/monthly-sheet-board.tsx
echo.
echo === Commit (skip if nothing new) ===
git commit -m "feat: 월간 취합표 UI 개선 - 셀 배지·아코디언 패널"
echo.
echo === Pull with no-edit (no vim!) ===
git pull --no-rebase --no-edit origin main
echo.
echo === Push ===
git push origin main
echo.
echo === Done! ===
pause
