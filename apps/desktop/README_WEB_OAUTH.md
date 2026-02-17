# Web-Based OAuth for Tauri Desktop App - Quick Start

## ✅ Implementation Complete!

Your desktop app now uses a **web-based OAuth flow** instead of native SDK/deep linking.

---

## 🎯 What Changed?

### ❌ Old Approach (Removed)
- Custom URL schemes (`kakao{KEY}://oauth`)
- Deep link handlers in Rust
- Complex OS-specific registration
- Unreliable on desktop platforms

### ✅ New Approach (Implemented)
- **Standard web OAuth** (HTTPS only)
- **WebView window** for login
- **Backend-controlled** authentication
- **Works reliably** on all platforms

---

## 🏗️ Architecture

```
Desktop App
    ↓ Opens WebView Window
Backend Login URL (/api/auth/kakao/start)
    ↓ Redirects to
Kakao OAuth (web platform)
    ↓ User logs in
Backend Callback (/api/auth/kakao/callback)
    ↓ Creates session token
Success Page (/api/auth/success?token=XXX)
    ↓ Desktop app detects URL
Token Exchange (/api/auth/exchange-token)
    ↓ Returns JWT
Desktop App (logged in) ✅
```

---

## 🚀 How to Use

### 1. Setup Environment

Create `.env.local`:
```bash
VITE_API_BASE_URL=http://localhost:8080
```

That's it! No Kakao keys needed in desktop app.

### 2. Implement Backend

Your backend needs these endpoints:
- `GET /api/auth/kakao/start` - Start OAuth
- `GET /api/auth/kakao/callback` - Kakao redirect
- `GET /api/auth/success?token=XXX` - Success page
- `POST /api/auth/exchange-token` - Get JWT

See **`BACKEND_OAUTH_GUIDE.md`** for complete implementation.

### 3. Run the App

```bash
npm run tauri:dev
```

Click "Login with Kakao" → WebView window opens → Login → Window closes → Done! ✅

---

## 📁 Key Files

### Frontend (Desktop App)
- `src/utils/oauth-web.ts` - WebView OAuth utilities
- `src/components/auth/LoginPage.tsx` - Login component
- `.env.development` / `.env.production` - Only needs backend URL

### Backend (Your API Server)
- See `BACKEND_OAUTH_GUIDE.md` for endpoints
- Kakao credentials configured in backend
- Session tokens for secure exchange

### Configuration
- `src-tauri/tauri.conf.json` - Clean config (no deep link)
- `src-tauri/capabilities/default.json` - WebView permissions

---

## 🔑 Why This Approach is Better

| Feature | Deep Link (Old) | Web-Based (New) |
|---------|-----------------|-----------------|
| **Reliability** | ⚠️ OS-dependent | ✅ Consistent |
| **Setup** | 🔴 Complex | 🟢 Simple |
| **Security** | 🟡 URL exposed | 🟢 Backend-controlled |
| **Cross-platform** | ⚠️ Different per OS | ✅ Same everywhere |
| **Debugging** | 🔴 Difficult | 🟢 Standard tools |
| **Kakao SDK** | 🔴 Not supported | 🟢 Web platform (official) |
| **User Experience** | ⚠️ Extra dialogs | ✅ Seamless |

**Winner:** Web-Based approach ✅

---

## 🔒 Security

### Desktop App (Frontend)
- Only knows backend URL
- No Kakao credentials stored
- Receives short-lived session tokens
- Exchanges for JWT over HTTPS

### Backend (API Server)
- Stores Kakao credentials securely
- Issues temporary session tokens (5-min expiry)
- Single-use tokens only
- Rate limiting on token exchange
- CSRF protection with state parameter

---

## 💡 How It Works

### Step 1: User Clicks Login
Desktop app opens a new Tauri WebView window:
```typescript
const result = await openWebOAuthWindow(
  `${API_BASE_URL}/api/auth/kakao/start`,
  '/auth/success'
)
```

### Step 2: Web OAuth Flow
Everything happens in the WebView:
1. Backend redirects to Kakao OAuth
2. User logs in on Kakao's website
3. Kakao redirects back to backend
4. Backend processes and creates session
5. Shows success page with session token

### Step 3: Desktop App Detects Success
The WebView URL is polled every 500ms:
```typescript
if (currentUrl.includes('/auth/success')) {
  const sessionToken = url.searchParams.get('token')
  // Close window and proceed
}
```

### Step 4: Token Exchange
Desktop app exchanges session token for real JWT:
```typescript
POST /api/auth/exchange-token
Body: { sessionToken: "temporary_token" }
Response: { accessToken, refreshToken, user }
```

### Step 5: Login Complete
App state updates, user is logged in! ✅

---

## 🧪 Testing

### Development
```bash
# Start backend
cd backend && npm run dev

# Start desktop app
npm run tauri:dev

# Click login button → WebView opens → Login → Success!
```

### Production Build
```bash
npm run tauri:build

# Install and test the .dmg/.exe
# Same flow works identically
```

---

## 📚 Documentation

- **`WEB_OAUTH_ARCHITECTURE.md`** - Complete architecture explanation
- **`BACKEND_OAUTH_GUIDE.md`** - Backend implementation guide
- **`src/utils/oauth-web.ts`** - Frontend utilities with inline docs

---

## 🐛 Troubleshooting

### WebView window doesn't open
**Check:** Permissions in `src-tauri/capabilities/default.json`
```json
{
  "permissions": [
    "core:window:allow-create",
    "core:webview:allow-create-webview-window"
  ]
}
```

### Backend not reachable
**Check:** `.env.local` has correct `VITE_API_BASE_URL`
**Check:** Backend is running and CORS is configured

### Token exchange fails
**Check:** Backend implemented `/api/auth/exchange-token` endpoint
**Check:** Session tokens expire after 5 minutes
**Check:** Tokens are single-use only

### Success page doesn't close
**Check:** Success page HTML includes auto-close script
**Check:** URL pattern `/auth/success` is detected correctly

---

## ✨ Benefits

### For Users
- ✅ Familiar web login experience
- ✅ No "Do you want to open this app?" dialogs
- ✅ Smooth, seamless flow
- ✅ Auto-closing login window

### For Developers
- ✅ Standard web OAuth (well-documented)
- ✅ Works identically on all platforms
- ✅ Easy to debug (browser DevTools)
- ✅ Backend controls all sensitive operations
- ✅ No OS-specific code needed
- ✅ No custom URL scheme registration

### For Security
- ✅ All credentials on backend only
- ✅ Short-lived session tokens
- ✅ Single-use tokens
- ✅ HTTPS-only communication
- ✅ Rate limiting protection

---

## 🎉 Summary

You've successfully migrated from unreliable deep linking to robust web-based OAuth:

✅ **Simplified:** Desktop app only needs backend URL  
✅ **Secure:** All credentials managed by backend  
✅ **Reliable:** Works consistently across all platforms  
✅ **Standard:** Uses official Kakao web platform APIs  
✅ **Maintainable:** Clear separation of concerns  

Your Tauri desktop app now has production-ready OAuth authentication! 🚀

