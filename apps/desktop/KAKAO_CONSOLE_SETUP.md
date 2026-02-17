# Kakao Developers Console Configuration Guide

## Step-by-Step Setup for Production OAuth

### 1. Access Kakao Developers Console
1. Go to https://developers.kakao.com/console/app
2. Sign in with your Kakao account
3. Select your application (or create a new one)

---

### 2. Get Your REST API Key
1. In the left sidebar, click **"App Settings" → "Summary"**
2. Find **"App Keys"** section
3. Copy your **"REST API Key"** (e.g., `abc123def456789...`)
4. Save this - you'll need it for environment variables

---

### 3. Configure Redirect URIs

#### Navigate to Platform Settings
1. In the left sidebar, click **"App Settings" → "Platform"**
2. Scroll to **"Redirect URI"** section
3. Click **"Modify"** button

#### Add Development Redirect URI
1. Click **"+ Add"** button
2. Enter: `http://localhost:1420/oauth/callback`
3. This is for development/testing only

#### Add Production Redirect URI (CRITICAL)
1. Click **"+ Add"** button again
2. Enter: `kakao{YOUR_REST_API_KEY}://oauth`
   - Replace `{YOUR_REST_API_KEY}` with your actual REST API Key
   - Example: If your key is `abc123def456`, enter: `kakaoabc123def456://oauth`
   - **No spaces, no brackets, exact format**

3. Click **"Save"** at the bottom

#### ⚠️ Important Notes:
- Both URIs must be added to Kakao Console
- The custom scheme MUST start with `kakao` followed by your REST API Key
- This is Kakao's required format for custom URI schemes
- Any mismatch will result in "redirect_uri mismatch" errors

---

### 4. Enable Kakao Login
1. In the left sidebar, click **"Product Settings" → "Kakao Login"**
2. Toggle **"Kakao Login Activation"** to ON
3. Under **"Redirect URI"**, verify both URIs are listed
4. Click **"Save Changes"**

---

### 5. Get Client Secret (if using)
1. Go to **"Product Settings" → "Kakao Login" → "Security"**
2. Click **"Generate Client Secret"** (if not already generated)
3. Copy the secret and store it securely
4. Toggle **"Activation Status"** to ON
5. Click **"Save"**

---

### 6. Set User Information Scope (Optional but Recommended)
1. Go to **"Product Settings" → "Kakao Login" → "Consent Items"**
2. Enable the following scopes:
   - **Profile information (nickname)** - Required
   - **Kakao account (email)** - Optional but recommended
3. Set collection purpose for each
4. Click **"Save"**

---

### 7. Verify Configuration

Your final setup should look like this:

```
Platform Settings → Redirect URI:
✅ http://localhost:1420/oauth/callback
✅ kakao{YOUR_REST_API_KEY}://oauth

Kakao Login:
✅ Activated
✅ Client Secret: Generated and Active

Consent Items:
✅ Profile (nickname): Enabled
✅ Email: Enabled (optional)
```

---

### 8. Update Your App Configuration

#### Update tauri.conf.json
Replace `kakaoYOUR_REST_API_KEY` with your actual scheme:

```json
{
  "plugins": {
    "deepLink": {
      "desktop": {
        "schemes": ["kakaoabc123def456"]  // Your actual scheme
      }
    }
  }
}
```

#### Update .env.production
```env
VITE_KAKAO_CLIENT_ID=abc123def456789  # Your REST API Key
VITE_KAKAO_CLIENT_SECRET=your_client_secret_here
VITE_KAKAO_REDIRECT_URI=kakaoabc123def456://oauth  # Your custom scheme
VITE_API_BASE_URL=https://api.yourproduction.com
```

---

### 9. Testing

#### Development Testing (localhost)
```bash
npm run tauri:dev
```
- Uses `http://localhost:1420/oauth/callback`
- Works immediately
- Standard web OAuth flow

#### Production Testing (deep link)
```bash
npm run tauri:build
```
- Install the built app (`.dmg`, `.app`, `.exe`)
- Run from Applications/Programs (not terminal)
- Click "Login with Kakao"
- Browser opens → Login → Redirects to `kakaoXXX://oauth`
- OS launches your app
- Login completes in app

---

### 10. Common Issues & Solutions

#### "redirect_uri mismatch" Error
- ✅ Verify exact match in Kakao Console
- ✅ No trailing slashes
- ✅ Check `VITE_KAKAO_REDIRECT_URI` in env file
- ✅ Rebuild app after changing config

#### Deep link not working
- ✅ Verify scheme in `tauri.conf.json` matches redirect URI
- ✅ Rebuild and **reinstall** the app (scheme registration happens at install)
- ✅ Check if another app uses the same scheme
- ✅ On macOS, try: `open kakaoYOURKEY://test` in terminal

#### "localhost:1420 not found" in production
- ❌ You're using development config in production build
- ✅ Check `.env.production` file exists
- ✅ Verify `VITE_KAKAO_REDIRECT_URI` is set to custom scheme
- ✅ Clear build cache: `rm -rf dist && npm run tauri:build`

---

### 11. Security Checklist

Before production deployment:

- [ ] REST API Key is in environment variables (not hardcoded)
- [ ] Client Secret is in environment variables (not hardcoded)
- [ ] `.env.local` and `.env.production.local` are in `.gitignore`
- [ ] Custom URI scheme matches exactly in Kakao Console and `tauri.conf.json`
- [ ] Backend validates Kakao tokens server-side
- [ ] HTTPS is used for production backend API
- [ ] Tokens are stored securely (consider Tauri's secure storage)

---

### 12. Platform-Specific Notes

#### macOS
- Deep link registration is automatic
- User may see "Open Desktop Calendar?" dialog first time
- No additional configuration needed

#### Windows
- Registry entry created during installation
- May require administrator privileges
- Uninstall and reinstall if scheme doesn't work

#### Linux
- Uses `.desktop` file for protocol handler
- May vary by desktop environment
- Test on target distribution

---

## Quick Reference

| Environment | Redirect URI | Where to Use |
|------------|--------------|--------------|
| Development | `http://localhost:1420/oauth/callback` | `.env.development` |
| Production | `kakao{REST_API_KEY}://oauth` | `.env.production` |

Both URIs must be registered in Kakao Developers Console!

---

## Need Help?

- **Kakao Docs**: https://developers.kakao.com/docs/latest/en/kakaologin/common
- **Tauri Deep Link**: https://v2.tauri.app/plugin/deep-link/
- **Check Logs**: Open DevTools in app (View → Toggle Developer Tools)

