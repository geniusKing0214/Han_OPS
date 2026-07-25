@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"

echo === Remove lock if exists ===
if exist ".git\index.lock" del /f ".git\index.lock"

echo === Pull ===
git pull --no-rebase --no-edit origin main

echo === Push ===
git push origin main

echo.
echo === Done! ===
pause
