f2 = r"C:\Users\New\Documents\GitHub\Han_OPS\src\components\admin\workforce\workforce-scheduler-panel.tsx"

with open(f2, 'r', encoding='utf-8') as fh:
    content = fh.read()

print("File: " + str(len(content)) + " chars")
lines = content.split('\n')
changes = 0

# Change 1: Import - add subscribeAllUsersForWorkforce after subscribeAllUsersForAdmin
for i, line in enumerate(lines):
    if 'subscribeAllUsersForAdmin,' in line and line.strip() == 'subscribeAllUsersForAdmin,':
        ws = line[:len(line) - len(line.lstrip())]
        lines.insert(i + 1, ws + 'subscribeAllUsersForWorkforce,')
        print("Change 1 OK (indent=" + repr(ws) + ")")
        changes += 1
        break
else:
    print("Change 1 FAIL")

# Rejoin for string-based changes
content = '\n'.join(lines)

# Change 2: useEffect call name
old2 = 'subscribeAllUsersForAdmin('
new2 = 'subscribeAllUsersForWorkforce('
if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Change 2 OK")
    changes += 1
else:
    print("Change 2 FAIL")

# Change 3: filter to include admins
old3 = 'rows.filter((r) => r.accountStatus === "approved")'
new3 = 'rows.filter((r) => r.accountStatus === "approved" || r.role === "admin")'
if old3 in content:
    content = content.replace(old3, new3, 1)
    print("Change 3 OK")
    changes += 1
else:
    print("Change 3 FAIL")

# Change 4: workerGroups - line-based replacement
lines = content.split('\n')
found4 = False
for i, line in enumerate(lines):
    if 'return TEAM_IDS.map((teamId) => ({' in line:
        ws_count = len(line) - len(line.lstrip())
        ws = ' ' * ws_count
        ws2 = ' ' * (ws_count + 2)
        ws3 = ' ' * (ws_count + 4)
        # Verify structure (lines i to i+6)
        if (i+6 < len(lines)
                and 'key: teamId,' in lines[i+1]
                and 'TEAM_LABELS[teamId]' in lines[i+2]
                and 'workers.filter(' in lines[i+3]
                and 'normalizeTeamId' in lines[i+4]
                and 'filter((g) => g.items.length > 0)' in lines[i+6]):
            new4 = [
                ws + 'const adminItems = workers.filter((w) => w.member.role === "admin");',
                ws + 'const groups: Array<{ key: string; label: string; items: typeof workers }> =',
                ws2 + 'TEAM_IDS.map((teamId) => ({',
                ws3 + 'key: teamId as string,',
                ws3 + 'label: `${TEAM_LABELS[teamId]}${statusSuffix}`,',
                ws3 + 'items: workers.filter(',
                ws3 + '  (w) => w.member.role !== "admin" && normalizeTeamId(w.member.team_id) === teamId,',
                ws3 + '),',
                ws2 + '})).filter((g) => g.items.length > 0);',
                ws + 'if (adminItems.length > 0) {',
                ws2 + 'groups.unshift({ key: "admin", label: `관리자${statusSuffix}`, items: adminItems });',
                ws + '}',
                ws + 'return groups;',
            ]
            lines[i:i+7] = new4
            print("Change 4 OK (indent=" + str(ws_count) + " spaces)")
            changes += 1
            found4 = True
            break
if not found4:
    print("Change 4 FAIL")
    for i, line in enumerate(lines):
        if 'TEAM_IDS.map' in line:
            print("  Found TEAM_IDS.map at line " + str(i+1) + ": " + repr(line))

content = '\n'.join(lines)
print("")
print(str(changes) + "/4 changes applied")
if changes == 4:
    with open(f2, 'w', encoding='utf-8') as fh:
        fh.write(content)
    print("SAVED!")
else:
    print("NOT saved")

input("Enter to close: ")