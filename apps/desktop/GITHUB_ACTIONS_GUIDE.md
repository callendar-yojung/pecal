# GitHub Actions를 사용한 자동 빌드 및 배포 가이드

## 🎯 개요

GitHub Actions를 사용하여 Kakao REST API 키와 같은 민감한 정보를 안전하게 주입하고, 자동으로 Tauri 앱을 빌드하는 방법입니다.

---

## 🔐 GitHub Secrets 설정

### 1단계: GitHub Repository로 이동

1. GitHub에서 프로젝트 저장소 열기
2. **Settings** 탭 클릭
3. 왼쪽 사이드바에서 **Secrets and variables** → **Actions** 클릭

### 2단계: Secrets 추가

**"New repository secret"** 버튼을 클릭하여 다음 secrets를 추가:

#### 필수 Secrets

| Secret 이름 | 설명 | 예시 값 |
|-------------|------|---------|
| `KAKAO_REST_API_KEY` | 카카오 REST API 키 | `abc123def456...` |
| `KAKAO_CLIENT_SECRET` | 카카오 클라이언트 시크릿 | `xyz789...` |
| `API_BASE_URL` | 백엔드 API URL | `https://api.yourproduction.com` |

#### 각 Secret 추가 방법:

1. **Name**: `KAKAO_REST_API_KEY`
2. **Secret**: 실제 카카오 REST API 키 입력
3. **Add secret** 클릭

위 과정을 모든 secrets에 대해 반복합니다.

---

## 🔧 작동 원리

### GitHub Actions 워크플로우가 하는 일:

#### 1️⃣ **tauri.conf.json 자동 수정**

빌드 시 다음 스크립트가 실행됩니다:

```bash
# Secret에서 REST API 키 읽기
KAKAO_KEY="${{ secrets.KAKAO_REST_API_KEY }}"

# 커스텀 URI 스킴 생성
CUSTOM_SCHEME="kakao${KAKAO_KEY}"

# tauri.conf.json 업데이트
node -e "
  const fs = require('fs');
  const config = JSON.parse(fs.readFileSync('./src-tauri/tauri.conf.json', 'utf8'));
  config.plugins.deepLink.desktop.schemes = ['kakao${KAKAO_KEY}'];
  fs.writeFileSync('./src-tauri/tauri.conf.json', JSON.stringify(config, null, 2));
"
```

**결과:**
```json
{
  "plugins": {
    "deepLink": {
      "desktop": {
        "schemes": ["kakaoABC123DEF456"]  // 실제 키로 자동 교체됨
      }
    }
  }
}
```

#### 2️⃣ **.env.production.local 자동 생성**

빌드 시 환경 변수 파일이 자동으로 생성됩니다:

```bash
cat > .env.production.local << EOF
VITE_KAKAO_CLIENT_ID=${{ secrets.KAKAO_REST_API_KEY }}
VITE_KAKAO_CLIENT_SECRET=${{ secrets.KAKAO_CLIENT_SECRET }}
VITE_KAKAO_REDIRECT_URI=kakao${{ secrets.KAKAO_REST_API_KEY }}://oauth
VITE_API_BASE_URL=${{ secrets.API_BASE_URL }}
EOF
```

#### 3️⃣ **Tauri 앱 빌드**

모든 설정이 주입된 상태에서 빌드:
- macOS: `.dmg`, `.app`
- Windows: `.exe`, `.msi`
- Linux: `.deb`, `.AppImage`

#### 4️⃣ **아티팩트 업로드**

빌드된 파일들이 GitHub Actions 아티팩트로 업로드됩니다.

---

## 📝 로컬 tauri.conf.json 설정

### 방법 1: 플레이스홀더 사용 (권장)

`src-tauri/tauri.conf.json`에 플레이스홀더 유지:

```json
{
  "plugins": {
    "deepLink": {
      "desktop": {
        "schemes": ["kakaoYOUR_REST_API_KEY"]
      }
    }
  }
}
```

**장점:**
- ✅ Secrets가 코드에 노출되지 않음
- ✅ GitHub Actions가 자동으로 교체
- ✅ 로컬 개발은 `.env.local` 사용 (localhost)

### 방법 2: 환경 변수 사용 (고급)

`tauri.conf.json`에서 환경 변수를 직접 사용할 수는 없지만, 빌드 스크립트를 사용할 수 있습니다.

**package.json에 스크립트 추가:**

```json
{
  "scripts": {
    "tauri:build": "node scripts/inject-config.js && tauri build",
    "tauri:dev": "tauri dev"
  }
}
```

**scripts/inject-config.js 생성:**

```javascript
const fs = require('fs');
const path = require('path');

// .env 파일 로드
require('dotenv').config({ path: '.env.production.local' });

const configPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// KAKAO_REST_API_KEY 환경 변수에서 읽기
const kakaoKey = process.env.VITE_KAKAO_CLIENT_ID;

if (kakaoKey) {
  if (!config.plugins) config.plugins = {};
  if (!config.plugins.deepLink) config.plugins.deepLink = {};
  if (!config.plugins.deepLink.desktop) config.plugins.deepLink.desktop = {};
  
  config.plugins.deepLink.desktop.schemes = [`kakao${kakaoKey}`];
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ tauri.conf.json updated with scheme: kakao' + kakaoKey);
} else {
  console.warn('⚠️ VITE_KAKAO_CLIENT_ID not found in environment');
}
```

**필요한 패키지 설치:**

```bash
npm install --save-dev dotenv
```

이제 로컬에서 빌드 시:

```bash
npm run tauri:build
```

`.env.production.local`에서 키를 읽어 자동으로 주입합니다.

---

## 🚀 사용 방법

### 자동 빌드 트리거

#### 방법 1: Push로 트리거

```bash
git add .
git commit -m "Release v1.0.0"
git push origin main
```

- `main` 또는 `develop` 브랜치에 push하면 자동 빌드 시작
- GitHub Actions 탭에서 진행 상황 확인

#### 방법 2: 수동 트리거

워크플로우 파일에 다음 추가:

```yaml
on:
  push:
    branches: [main, develop]
  workflow_dispatch:  # 수동 트리거 활성화
```

이후 GitHub에서:
1. **Actions** 탭 클릭
2. **Build Tauri App** 워크플로우 선택
3. **Run workflow** 버튼 클릭

---

## 📦 빌드 결과물 다운로드

### 방법 1: GitHub Actions Artifacts

1. GitHub 저장소 → **Actions** 탭
2. 완료된 워크플로우 클릭
3. 아래 **Artifacts** 섹션에서 다운로드:
   - `desktop-calendar-macos-latest`
   - `desktop-calendar-ubuntu-latest`
   - `desktop-calendar-windows-latest`

### 방법 2: GitHub Releases (릴리스 태그 사용 시)

Git 태그를 push하면 자동으로 Release 생성:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub → **Releases** 탭에서 다운로드 가능합니다.

---

## 🔒 보안 Best Practices

### ✅ 해야 할 것

- GitHub Secrets에 모든 민감한 정보 저장
- `tauri.conf.json`에 실제 키 커밋하지 않기
- `.env.production.local`을 `.gitignore`에 추가 (이미 추가됨)
- GitHub Actions 로그에서 secrets가 자동 마스킹되는지 확인

### ❌ 하지 말아야 할 것

- 절대 실제 키를 코드에 하드코딩하지 않기
- `.env` 파일을 git에 커밋하지 않기
- Pull Request에서 secrets 노출하지 않기
- Public 저장소에서는 특히 주의

---

## 🐛 문제 해결

### "Secret not found" 에러

**증상:** GitHub Actions에서 빌드 실패

**해결:**
1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. 필요한 모든 secrets가 등록되어 있는지 확인
3. Secret 이름이 정확히 일치하는지 확인 (대소문자 구분)

### 빌드는 성공했지만 앱이 작동하지 않음

**증상:** 앱 설치 후 OAuth 리다이렉트 실패

**해결:**
1. 카카오 개발자 콘솔에서 Redirect URI 확인:
   - `kakao{실제_REST_API_KEY}://oauth` 등록되어 있어야 함
2. 빌드된 앱을 완전히 언인스톨 후 재설치
3. 터미널에서 테스트: `open kakaoYOURKEY://test`

### 로컬 빌드와 GitHub Actions 빌드 결과가 다름

**증상:** 로컬에서는 작동하지만 CI 빌드는 실패

**해결:**
1. 로컬에서 프로덕션 빌드 테스트:
   ```bash
   npm run tauri:build
   ```
2. `.env.production.local`과 GitHub Secrets가 동일한지 확인
3. GitHub Actions 로그에서 주입된 값 확인

---

## 📋 체크리스트

배포 전 확인사항:

- [ ] GitHub Secrets에 모든 필수 값 추가
  - [ ] `KAKAO_REST_API_KEY`
  - [ ] `KAKAO_CLIENT_SECRET`
  - [ ] `API_BASE_URL`
- [ ] 카카오 개발자 콘솔에 커스텀 URI 스킴 등록
  - [ ] `kakao{YOUR_KEY}://oauth`
- [ ] `tauri.conf.json`에 플레이스홀더 유지
  - [ ] `"schemes": ["kakaoYOUR_REST_API_KEY"]`
- [ ] `.env.production.local`이 `.gitignore`에 포함
- [ ] GitHub Actions 워크플로우 파일 생성
  - [ ] `.github/workflows/build.yml`
- [ ] 테스트 빌드 실행 및 확인

---

## 🎉 완료!

이제 다음과 같은 자동화 파이프라인이 구축되었습니다:

```
코드 Push
  ↓
GitHub Actions 시작
  ↓
Secrets에서 REST API 키 읽기
  ↓
tauri.conf.json 자동 수정
  ↓
.env.production.local 자동 생성
  ↓
멀티 플랫폼 빌드
  ↓
아티팩트 업로드 / Release 생성
  ↓
배포 완료! 🎉
```

**장점:**
- ✅ 민감한 정보가 코드에 노출되지 않음
- ✅ 멀티 플랫폼 자동 빌드
- ✅ 일관된 프로덕션 빌드
- ✅ 팀원 모두 동일한 환경에서 빌드

---

## 📚 추가 자료

- [GitHub Actions - Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Tauri GitHub Action](https://github.com/tauri-apps/tauri-action)
- [GitHub Actions 워크플로우 문법](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

