Set fso = CreateObject("Scripting.FileSystemObject")
Dim base, out
base = "C:\Users\New\Documents\GitHub\Han_OPS\src\"
out = "C:\Users\New\Documents\GitHub\Han_OPS\repo_dump.txt"

Dim files(9)
files(0) = "types\schedule.ts"
files(1) = "types\application.ts"
files(2) = "types\workforce.ts"
files(3) = "lib\firestore-applications.ts"
files(4) = "lib\firestore-events.ts"
files(5) = "lib\firestore-workforce.ts"
files(6) = "lib\schedule-mutations.ts"
files(7) = "lib\firestore-users.ts"
files(8) = "components\admin\workforce\workforce-scheduler-panel.tsx"
files(9) = "components\member\schedule\schedule-list.tsx"

Set w = fso.CreateTextFile(out, True)
Dim i
For i = 0 To 9
    Dim fp
    fp = base & files(i)
    If fso.FileExists(fp) Then
        w.WriteLine "===== " & files(i) & " ====="
        Set r = fso.OpenTextFile(fp, 1)
        w.WriteLine r.ReadAll
        r.Close
        w.WriteLine ""
    Else
        w.WriteLine "===== " & files(i) & " (NOT FOUND) ====="
        w.WriteLine ""
    End If
Next
w.Close
MsgBox "Done! repo_dump.txt saved."
