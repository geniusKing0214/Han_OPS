# Han OPS

HAN OPS 웹 앱 (Next.js 15 · Firebase Auth / Firestore)

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local
# .env.local 에 Firebase 설정 값 채운 뒤 (NEXT_PUBLIC_* 은 빈 칸 없이)
npm run dev
```

GitHub Pages용으로 로컬에서 빌드만 검증할 때는 (레포 이름이 `Han_OPS` 인 경우):

```bash
# 예: Linux/macOS/Git Bash
STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/Han_OPS npm run build
```

빌드 결과는 `out/` 디렉터리입니다.

---

## GitHub Pages 로 배포 (이 레포 기준)

이 레포에는 [`.github/workflows/github-pages.yml`](./.github/workflows/github-pages.yml) 워크플로가 포함되어 있습니다. 저장소 이름이 URL 경로와 같습니다. 예: 레포가 `Han_OPS`이면 사이트 주소는 `https://<본인-ID>.github.io/Han_OPS/` 형태입니다.

### 접속 주소 (404 방지)

| 주소 | 결과 |
|------|------|
| `https://geniusking0214.github.io/Han_OPS/` | **앱** (로그인·대시보드) |
| `https://geniusking0214.github.io/` | GitHub 기본 **404** (이 레포는 프로젝트 Pages라 루트에 사이트 없음) |

북마크·공유·Firebase Authorized domains는 **`…/Han_OPS/`** 까지 포함한 주소를 쓰세요.  
`https://geniusking0214.github.io/` 만 열면 스크린샷과 같은 “There isn't a GitHub Pages site here” 가 나옵니다.

루트(`github.io/`)에서도 자동 이동하려면 GitHub에 **`geniusking0214.github.io`** 이름의 **별도** public 레포를 만들고, [redirect-root/index.html](./redirect-root/index.html) 내용만 그 레포 루트의 `index.html` 로 넣은 뒤 Pages를 **main / root** 로 켜면 됩니다.

### 1) Repository secrets 등록

GitHub 레포 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

로컬 `.env.local` 과 같은 이름으로 다음을 추가합니다 (`NEXT_PUBLIC_` 포함):

| Secret 이름 |
|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` |

워크플로에서 `NEXT_PUBLIC_BASE_PATH` 는 자동으로 `/${{ github.event.repository.name }}` 로 맞춥니다 (레포 이름 변경 시에도 그에 맞게 동작합니다).

### 2) GitHub Pages 설정

레포 → **Settings** → **Pages**

- **Source**: **GitHub Actions** 선택

그다음 `main` 에 푸시하거나 **Actions** 탭에서 워크플로를 수동 실행하면 배포가 진행됩니다.

### 3) Firebase

프로젝트 루트 URL이 바뀌므로 Firebase Console을 열고:

- **Authentication → Settings → Authorized domains** 에  
  `본인githubid.github.io` 를 추가합니다. (서브 경로가 있어도 **도메인만** 등록합니다.)

#### Safari / iOS 로그인 (missing initial state 오류 방지)

GitHub Pages(`*.github.io`)에서 Safari로 로그인할 때 Firebase redirect 오류가 날 수 있습니다.  
GitHub Actions **Variables** 또는 로컬 `.env.local` 에 아래를 추가하세요.

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Firebase Console → Authentication → Google → **Web client ID** |

Google Cloud Console → OAuth 클라이언트 → **승인된 JavaScript 원본**에  
`https://본인githubid.github.io` 를 추가합니다.

앱을 `*.firebaseapp.com` 에만 호스팅하는 경우에는 위 변수 없이 redirect 로그인이 동작합니다.

### 4) 주의

- **정적(static) 배포**: 서버 API·서버 전용 기능 없이 동작합니다.
- 이벤트「새 창에서 편집」은 GitHub Pages 호환을 위해  
  `/admin/schedule/edit?id=이벤트ID` 형식으로 열립니다.

---

## 배포 대안: Vercel

Next.js 호스트로 **Vercel**을 쓰면 `basePath`/정적 내보내기 설정 없이 더 단순하게 올릴 수 있습니다. 필요 시 [vercel.com](https://vercel.com) 에서 동일 레포를 Import 하고, 동일한 `NEXT_PUBLIC_FIREBASE_*` 환경 변수를 넣으면 됩니다 (Vercel 사용 시 **Authorized domains** 에 `*.vercel.app` 또는 배포 URL 추가).
