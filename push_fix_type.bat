@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"
git pull --no-rebase --no-edit origin main
git push origin main
pause
