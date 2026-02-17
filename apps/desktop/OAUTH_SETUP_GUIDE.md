# OAuth Redirect Strategy for Tauri Desktop App

## Why localhost MUST NOT be used in production

### The Problem
When you package a Tauri desktop app, there is **no local web server running** on `http://localhost:1420`. That server only exists during development when Vite is running. In production:

1. ❌ The app runs as a standalone desktop binary
2. ❌ No web server is listening on localhost:1420
3. ❌ OAuth redirects to localhost:1420 will fail (browser opens, but nothing handles it)
4. ❌ Users see a "Cannot connect" error page instead of returning to your app

### The Solution: Custom URI Scheme (Deep Linking)

Desktop apps (like mobile apps) use **custom URI schemes** to handle OAuth callbacks:
- ✅ Works in packaged apps without any server
- ✅ OS registers your app to handle the custom scheme
- ✅ When browser redirects to `your-scheme://oauth`, OS launches your app
- ✅ Your app receives the OAuth code/token via the deep link

---

## Step 1: Kakao Developers Console Configuration

### 1.1 Get your Kakao REST API Key
- Go to https://developers.kakao.com/console/app
- Select your application
- Copy the **REST API Key** (e.g., `abc123def456...`)

### 1.2 Add Custom Redirect URI

For Kakao, you need to use their specific custom scheme format:

```
Development:  http://localhost:1420/oauth/callback
Production:   kakao{YOUR_REST_API_KEY}://oauth
```

**Example:** If your REST API Key is `abc123def456`, your redirect URI is:
```
kakaoabc123def456://oauth
```

**Steps:**
1. Go to **My Application > App Settings > Platform**
2. Under **Redirect URI**, click "Add"
3. Add both URIs:
   - `http://localhost:1420/oauth/callback` (for development)
   - `kakaoabc123def456://oauth` (for production)
4. Click **Save**

**Important:** Kakao requires you to use `kakao{REST_API_KEY}://` format for custom schemes.

---

## Step 2: Tauri Configuration (tauri.conf.json)

The custom URI scheme must be registered in your Tauri config so the OS knows your app handles it.

### What was added:
```json
{
  "bundle": {
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.15",
      "exceptionDomain": ""
    },
    "iOS": {},
    "android": {},
    "deeplink": {
      "protocol": "kakaoabc123def456",
      "schemes": ["kakaoabc123def456"]
    }
  }
}
```

### Configuration Notes:
- Replace `kakaoabc123def456` with your actual `kakao{REST_API_KEY}`
- The `protocol` field is what the OS uses to route URIs to your app
- When user is redirected to `kakaoabc123def456://oauth?code=...`, your app will launch/focus
- Tauri v2 uses the `deeplink` configuration for this

---

## Step 3: Deep Link Handler (Rust)

This Rust code listens for deep link events and sends them to your frontend.

### File: `src-tauri/src/deep_link.rs`
This handles incoming OAuth redirects via the custom scheme.

### How it works:
1. When Kakao redirects to `kakaoabc123def456://oauth?code=XXX`
2. OS launches your app (or brings it to focus if already running)
3. Tauri's deep link plugin captures the URL
4. We extract the `code` parameter
5. We emit an event to the frontend with the code
6. Frontend exchanges code for tokens

---

## Step 4: Environment Variables

### Create `.env.development`:
```env
VITE_KAKAO_CLIENT_ID=your_rest_api_key
VITE_KAKAO_CLIENT_SECRET=your_client_secret
VITE_KAKAO_REDIRECT_URI=http://localhost:1420/oauth/callback
VITE_API_BASE_URL=http://localhost:8080
```

### Create `.env.production`:
```env
VITE_KAKAO_CLIENT_ID=your_rest_api_key
VITE_KAKAO_CLIENT_SECRET=your_client_secret
VITE_KAKAO_REDIRECT_URI=kakaoYOUR_REST_API_KEY://oauth
VITE_API_BASE_URL=https://api.yourproduction.com
```

**Security Note:** Never commit these files to git. Add them to `.gitignore`.

---

## Step 5: Frontend Deep Link Handler

Your React app needs to:
1. Listen for deep link events from the Rust backend
2. Extract the OAuth code
3. Exchange it for tokens
4. Log the user in

This is implemented in `src/utils/deeplink.ts` and integrated into your `LoginPage.tsx`.

---

## Step 6: Build Process

### Development:
```bash
npm run tauri:dev
```
Uses `http://localhost:1420/oauth/callback` (standard web flow)

### Production:
```bash
npm run tauri:build
```
Uses `kakao{REST_API_KEY}://oauth` (deep link flow)

**Important:** You can't test deep linking in dev mode. You must build and install the app to test production OAuth flow.

---

## Complete OAuth Flow (Production)

```
1. User clicks "Login with Kakao" button
   ↓
2. App opens browser: https://kauth.kakao.com/oauth/authorize?...&redirect_uri=kakaoXXX://oauth
   ↓
3. User logs in to Kakao in browser
   ↓
4. Kakao redirects: kakaoXXX://oauth?code=AUTH_CODE
   ↓
5. OS sees "kakaoXXX://" → Launches/focuses your app
   ↓
6. Tauri deep link handler receives URL
   ↓
7. Extracts code, emits event to frontend
   ↓
8. Frontend exchanges code for Kakao access token
   ↓
9. Frontend sends Kakao token to your backend
   ↓
10. Backend returns your app's JWT tokens
   ↓
11. User is logged in ✅
```

---

## Testing Production Flow

1. Build the app: `npm run tauri:build`
2. Install the `.dmg` / `.app` (macOS) or `.exe` (Windows)
3. Run the installed app (not from terminal)
4. Click "Login with Kakao"
5. Browser should open → Login → Redirect back to app

**Debugging:**
- Check Tauri console logs (View > Toggle Developer Tools)
- Verify deep link is registered: `open kakaoYOURKEY://test` in terminal
- Check Kakao Developer Console > My Application > Logs

---

## Platform-Specific Notes

### macOS
- Deep links work automatically after building
- System registers the URI scheme on first launch
- User may see "Do you want to open this app?" prompt first time

### Windows
- Registry entry is created during installation
- May require admin rights for first install
- Deep link format: `kakaoXXX://oauth`

### Linux
- Uses `.desktop` file to register protocol handler
- May vary by desktop environment (GNOME, KDE, etc.)

---

## Security Best Practices

1. **Never hardcode secrets** in frontend code
2. **Use environment variables** for all sensitive data
3. **Exchange tokens on backend** when possible
4. **Validate redirect URI** matches exactly in Kakao console
5. **Use HTTPS** for production backend API
6. **Implement PKCE** (Proof Key for Code Exchange) if Kakao supports it
7. **Store tokens securely** using Tauri's secure storage

---

## Troubleshooting

### "Deep link not working"
- Verify `protocol` in `tauri.conf.json` matches your redirect URI scheme
- Rebuild and reinstall the app (scheme registration happens during install)
- Check if another app is registered for the same scheme

### "Redirect URI mismatch" error
- Ensure Kakao console has exact redirect URI: `kakao{KEY}://oauth`
- No trailing slashes, exact match required
- Check environment variable is loaded correctly

### "localhost:1420 not found" in production
- You're using development config in production build
- Verify `.env.production` is being used
- Check `VITE_KAKAO_REDIRECT_URI` value at runtime

---

## Summary

✅ **Development:** Uses `http://localhost:1420` (easy debugging)  
✅ **Production:** Uses `kakao{REST_API_KEY}://oauth` (deep linking)  
✅ **Configured:** Tauri, Kakao Console, Environment Variables  
✅ **Handled:** Deep link capture, code exchange, login flow  

Your app now has a production-ready OAuth flow that works as a true desktop application!

