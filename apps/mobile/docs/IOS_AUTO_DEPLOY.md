# iOS 자동 배포 (TestFlight)

## 1) 먼저 할 일 (필수)

1. App Store Connect API Key 생성
- App Store Connect > Users and Access > Keys
- `Issuer ID`, `Key ID`, `.p8` 확보

2. GitHub Secrets 추가 (repo 또는 org)
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_CONTENT` (`.p8` 파일 내용을 그대로 문자열로 저장)
- `APPLE_TEAM_ID`
- `APP_STORE_CONNECT_TEAM_ID` (선택)
- `APP_STORE_CONNECT_APPLE_ID` (선택)

3. 코드서명 방식 선택
- 권장: `fastlane match`
- match 사용 시 추가 secrets:
  - `MATCH_GIT_URL`
  - `MATCH_PASSWORD`
  - `MATCH_READONLY` (`true`/`false`)

## 2) CI 실행 방법

### 방법 A: 수동 실행
1. GitHub > Actions > `iOS Build & TestFlight`
2. `Run workflow`
3. lane 선택:
- `beta`: TestFlight 업로드
- `release`: 심사 제출

### 방법 B: 태그 푸시 자동 실행
- `ios-v1.0.0` 같은 태그 푸시 시 자동으로 `beta` lane 실행

## 3) 추가 확인 포인트

1. iOS 번들 ID 일치 확인
- 현재 기본값: `com.pecal.mobile`
- 다르면 `IOS_APP_IDENTIFIER`를 workflow/env에서 변경

2. Xcode 서명 설정
- `PecalMobile` 타깃 Signing 설정이 match/인증서 정책과 일치해야 함

3. 첫 배포는 수동 권장
- 먼저 `beta` lane으로 TestFlight 업로드 성공 확인
- 이후 `release` 자동화 적용
