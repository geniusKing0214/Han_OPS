@echo off
cd /d "C:\Users\New\Documents\GitHub\Han_OPS"
git merge --abort 2>nul
git add src/lib/firestore-users.ts
git add src/components/admin/workforce/workforce-scheduler-panel.tsx
git commit -m "feat: workforce admin visibility + team grouping"
git pull --no-rebase --no-edit origin main
git push origin main
echo === PUSH DONE ===
timeout /t 60 /nobreak