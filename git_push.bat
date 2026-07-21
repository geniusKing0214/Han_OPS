@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
echo === Step 1: Stage our 3 modified files ===
git add src/components/monthly-sheet/monthly-sheet-calendar-grid.tsx
git add src/components/monthly-sheet/monthly-sheet-day-detail.tsx
git add src/components/monthly-sheet/monthly-sheet-board.tsx
echo.
echo === Step 2: Commit ===
git commit -m "feat: 월간 취합표 UI 개선 - 셀 배지·아코디언 패널"
echo.
echo === Step 3: Pull remote changes (merge) ===
git pull --no-rebase origin main
echo.
echo === Step 4: Push ===
git push origin main
echo.
echo === Done! Check above for errors ===
pause