Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
Dim log
log = "C:\Users\New\Documents\GitHub\Han_OPS\git_log.txt"

Dim pyPath
pyPath = "C:\Users\New\Documents\GitHub\Han_OPS\fix_users.py"
Set f = fso.CreateTextFile(pyPath, True)
f.WriteLine "path = r'C:\Users\New\Documents\GitHub\Han_OPS\src\lib\firestore-users.ts'"
f.WriteLine "with open(path, 'r', encoding='utf-8') as f:"
f.WriteLine "    c = f.read()"
f.WriteLine "if 'subscribeAllUsersForWorkforce' not in c:"
f.WriteLine "    func = '\n/** Workforce scheduler: subscribe all users including admins */\nexport function subscribeAllUsersForWorkforce(\n  onData: (rows: ListedUserRow[]) => void,\n  onError?: (error: FirestoreError) => void,\n) {\n  return onSnapshot(\n    collection(db, USERS_COLLECTION),\n    (snap) => {\n      const rows = snap.docs.map((d) => ({\n        uid: d.id,\n        ...(d.data() as UserProfileDoc),\n      }));\n      onData(rows);\n    },\n    (err) => onError?.(err),\n  );\n}\n'"
f.WriteLine "    with open(path, 'a', encoding='utf-8', newline='') as g:"
f.WriteLine "        g.write(func)"
f.WriteLine "    print('PATCHED')"
f.WriteLine "else:"
f.WriteLine "    print('ALREADY_EXISTS')"
f.Close

sh.Run "cmd.exe /c (cd /d ""C:\Users\New\Documents\GitHub\Han_OPS"" & python fix_users.py & git add src/lib/firestore-users.ts & git commit -m ""fix: add subscribeAllUsersForWorkforce"" & git pull --no-rebase --no-edit origin main & git push origin main) > """ & log & """ 2>&1", 0, True

Set f = fso.OpenTextFile(log, 1)
MsgBox f.ReadAll
f.Close
