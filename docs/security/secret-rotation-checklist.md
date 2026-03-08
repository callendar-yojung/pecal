# Secret Rotation Checklist

A GitHub token was exposed during local troubleshooting. Rotate secrets before using the old values again.

## Rotate immediately

- GitHub personal access token used for certificate repository access
- Any token copied into terminal history or CI logs during troubleshooting

## Verify repository secrets

- `MATCH_GIT_URL`
- `MATCH_PASSWORD`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_CONTENT`
- `MATCH_PASSWORD`
- `MATCH_GIT_URL`
- any Expo, Vercel, or backend deployment tokens

## After rotation

```bash
gh auth logout --hostname github.com
gh auth login
```

Update local shells, CI secrets, password managers, and any shared runbooks.

## iOS specific

Before rerunning iOS deploy:

- confirm `com.pecal.mobile` has Sign in with Apple enabled in Apple Developer
- regenerate the App Store provisioning profile in the match repository
- rerun `fastlane match appstore` with the updated profile
