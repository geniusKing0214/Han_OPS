Set sh = CreateObject("WScript.Shell")
sh.Run "cmd.exe /c (cd /d ""C:\Users\New\Documents\GitHub\Han_OPS"" & git merge --abort & git add src/lib/firestore-users.ts & git add src/components/admin/workforce/workforce-scheduler-panel.tsx & git commit -m ""feat: workforce admin visibility + team grouping"" & git pull --no-rebase --no-edit origin main & git push origin main) > ""C:\Users\New\Documents\GitHub\Han_OPS\git_log.txt"" 2>&1", 0, True
Set fso = CreateObject("Scripting.FileSystemObject")
Set f = fso.OpenTextFile("C:\Users\New\Documents\GitHub\Han_OPS\git_log.txt", 1)
MsgBox f.ReadAll
f.Close