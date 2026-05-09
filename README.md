# Han OPS

HAN OPS 웹 앱 (Next.js 15 · Firebase Auth / Firestore)

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local
# .env.local 에 Firebase 설정 값 채운 뒤
npm run dev
```

## 사람들에게 링크로 보여 주기 — 배포 (권장: Vercel)

이 저장소는 **Next.js**라서 **[Vercel](https://vercel.com)** 과 연결하는 방식이 가장 단순합니다. (순정 Next 빌드를 그대로 사용)

### 1) Vercel에서 GitHub 저장소 연결

1. [vercel.com](https://vercel.com) 접속 후 GitHub 로그인
2. **Add New… → Project** → `Han_OPS` 레포 선택 → **Import**
3. **Root Directory**: 코드가 레포 최상단이 아니면 `han-ops` 폴더만 올린 경우 해당 폴더를 선택  
   *(현재 [Han_OPS](https://github.com/geniusKing0214/Han_OPS) 에 Next 앱이 루트에 있으면 그대로 두면 됩니다.)*
4. **Framework Preset**: Next.js (자동)
5. **Environment Variables**: 아래 이름으로 Firebase 값을 하나씩 등록 (`Production` 선택)

   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

   (로컬 `.env.local` 에 있는 값과 동일하게 넣으면 됩니다.)

6. **Deploy** 클릭 → 완료되면 `https://프로젝트명.vercel.app` 주소가 생깁니다.

### 2) Firebase에서 배포 도메인 허용

로그인(구글)이 배포 주소에서 동작해야 합니다.

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. **도메인 추가** 에 `*.vercel.app` 또는 배포 후 나온 정확한 호스트 (예: `han-ops-xxx.vercel.app`) 추가

### 3) 공유

배포 URL을 보내면 됩니다. (비공개 테스트가 필요하면 Vercel **Deployment Protection** 또는 저장소 비공개 + 팀 초대 등을 검토하세요.)

---

## 그 외 옵션 (참고)

- **Firebase Hosting**: `next build` + 정적 출력 등 추가 설정이 필요해 이 레포 구조에서는 보통 Vercel이 더 간단합니다.
- **순수 GitHub Pages**: 동적 라우트(`/admin/schedule/[eventId]` 등) 때문에 같은 방식 그대로는 맞추기 어렵고, 다른 배포 형태 검토가 필요합니다.
