$ErrorActionPreference = 'Stop'
$repoRoot = "C:\Users\New\Documents\GitHub\Han_OPS"

# ============================================================
# 1. firestore-users.ts: subscribeAllUsersForWorkforce 추가
# ============================================================
$f1 = Join-Path $repoRoot "src\lib\firestore-users.ts"
$c1 = [System.IO.File]::ReadAllText($f1, [System.Text.Encoding]::UTF8)

if ($c1 -notmatch 'subscribeAllUsersForWorkforce') {
  $newFn = @'

/** 인력 배치 스케줄러용: 관리자 포함 전체 사용자 실시간 구독 */
export function subscribeAllUsersForWorkforce(
  onData: (rows: ListedUserRow[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    collection(db, USERS_COLLECTION),
    (snap) => {
      const rows = snap.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as UserProfileDoc),
      }));
      onData(rows);
    },
    (err) => onError?.(err),
  );
}
'@
  $anchor = '/** 본인 프로필 필드만 갱신'
  $c1 = $c1.Replace($anchor, $newFn.TrimStart("`r`n") + "`n`n" + $anchor)
  [System.IO.File]::WriteAllText($f1, $c1, [System.Text.Encoding]::UTF8)
  Write-Host "OK: firestore-users.ts 패치 완료"
} else {
  Write-Host "SKIP: firestore-users.ts 이미 패치됨"
}

# ============================================================
# 2. workforce-scheduler-panel.tsx 패치
# ============================================================
$f2 = Join-Path $repoRoot "src\components\admin\workforce\workforce-scheduler-panel.tsx"
$c2 = [System.IO.File]::ReadAllText($f2, [System.Text.Encoding]::UTF8)

# 2a. import에 새 함수 추가
if ($c2 -notmatch 'subscribeAllUsersForWorkforce') {
  $c2 = $c2.Replace(
    '  subscribeAllUsersForAdmin,',
    "  subscribeAllUsersForAdmin,`n  subscribeAllUsersForWorkforce,"
  )
  Write-Host "  import 추가됨"
}

# 2b. useEffect: subscribeAllUsersForAdmin -> subscribeAllUsersForWorkforce + admin 포함
$old2b = @'
    return subscribeAllUsersForAdmin(
      (rows) =>
        setMembers(
          rows.filter((r) => r.accountStatus === "approved"),
        ),
'@
$new2b = @'
    return subscribeAllUsersForWorkforce(
      (rows) =>
        setMembers(
          rows.filter((r) => r.accountStatus === "approved" || r.role === "admin"),
        ),
'@
$c2 = $c2.Replace($old2b, $new2b)
Write-Host "  useEffect 교체됨"

# 2c. workerGroups: 관리자 그룹 별도 섹션
$old2c = @'
    return TEAM_IDS.map((teamId) => ({
      key: teamId,
      label: `${TEAM_LABELS[teamId]}${statusSuffix}`,
      items: workers.filter(
        (w) => normalizeTeamId(w.member.team_id) === teamId,
      ),
    })).filter((g) => g.items.length > 0);
'@
$new2c = @'
    const adminItems = workers.filter((w) => w.member.role === "admin");
    const groups: Array<{ key: string; label: string; items: typeof workers }> =
      TEAM_IDS.map((teamId) => ({
        key: teamId as string,
        label: `${TEAM_LABELS[teamId]}${statusSuffix}`,
        items: workers.filter(
          (w) => w.member.role !== "admin" && normalizeTeamId(w.member.team_id) === teamId,
        ),
      })).filter((g) => g.items.length > 0);
    if (adminItems.length > 0) {
      groups.unshift({ key: "admin", label: `관리자${statusSuffix}`, items: adminItems });
    }
    return groups;
'@
$c2 = $c2.Replace($old2c, $new2c)
Write-Host "  workerGroups 교체됨"

[System.IO.File]::WriteAllText($f2, $c2, [System.Text.Encoding]::UTF8)
Write-Host "OK: workforce-scheduler-panel.tsx 패치 완료"
Write-Host ""
Write-Host "=== 모든 패치 완료! ==="
