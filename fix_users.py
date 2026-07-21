path = r'C:\Users\New\Documents\GitHub\Han_OPS\src\lib\firestore-users.ts'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()
if 'subscribeAllUsersForWorkforce' not in c:
    func = '\n/** Workforce scheduler: subscribe all users including admins */\nexport function subscribeAllUsersForWorkforce(\n  onData: (rows: ListedUserRow[]) => void,\n  onError?: (error: FirestoreError) => void,\n) {\n  return onSnapshot(\n    collection(db, USERS_COLLECTION),\n    (snap) => {\n      const rows = snap.docs.map((d) => ({\n        uid: d.id,\n        ...(d.data() as UserProfileDoc),\n      }));\n      onData(rows);\n    },\n    (err) => onError?.(err),\n  );\n}\n'
    with open(path, 'a', encoding='utf-8', newline='') as g:
        g.write(func)
    print('PATCHED')
else:
    print('ALREADY_EXISTS')
