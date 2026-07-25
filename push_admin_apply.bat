@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"
git add src/lib/firestore-applications.ts
git commit -m "feat: allow admin to apply for events without team restriction"
git pull --no-rebase --no-edit origin main
git push origin main
pause
