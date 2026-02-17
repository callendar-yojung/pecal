# Web-Based OAuth Flow for Tauri Desktop App

## 🎯 Why Web-Based OAuth Instead of Native SDK/Deep Linking?

### ❌ Problems with Native Approach (Deep Linking)
1. **Unreliable on Desktop** - Custom URL schemes often blocked by security software
2. **OS-specific issues** - Different behavior on macOS/Windows/Linux
3. **SDK limitations** - Kakao SDK not designed for desktop environments
4. **Registration complexity** - Requires app store registration for some platforms
5. **User confusion** - "Do you want to open this app?" dialogs are jarring

### ✅ Benefits of Web-Based Approach
1. **Cross-platform reliability** - Works identically on all platforms
2. **Standard web OAuth** - Uses Kakao's official Web platform APIs
3. **No custom schemes** - Just standard HTTPS redirects
4. **Better UX** - Familiar web login experience
5. **Easier debugging** - Standard browser DevTools work
6. **No native dependencies** - Pure web technologies

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Desktop App (Tauri)                                             │
│                                                                 │
│  1. User clicks "Login with Kakao"                             │
│     ↓                                                           │
│  2. Open WebView window with login URL                         │
│     └→ https://your-backend.com/auth/kakao/start               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Web Login Page (Backend-hosted)                                │
│                                                                 │
│  3. Redirect to Kakao OAuth                                    │
│     └→ https://kauth.kakao.com/oauth/authorize?...             │
│                                                                 │
│  4. User logs in on Kakao's page                               │
│     ↓                                                           │
│  5. Kakao redirects to your backend                            │
│     └→ https://your-backend.com/auth/kakao/callback?code=XXX   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend                                                         │
│                                                                 │
│  6. Exchange code for Kakao access token                       │
│  7. Get user info from Kakao                                   │
│  8. Create/update user in your database                        │
│  9. Generate YOUR app's JWT token                              │
│  10. Store session with temporary token                        │
│  11. Redirect to success page with session token               │
│     └→ https://your-backend.com/auth/success?token=TEMP123     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Desktop App (Polling/Event Detection)                          │
│                                                                 │
│  12. WebView detects success page                              │
│  13. Extract session token from URL                            │
│  14. Close WebView window                                      │
│  15. Exchange session token for actual JWT                     │
│      └→ POST /auth/exchange-token { sessionToken }             │
│  16. Store JWT and update app state                            │
│  17. User is logged in! ✅                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Components

### 1. **Backend Routes (Your Express/FastAPI/etc.)**

```
GET  /auth/kakao/start       → Initiates OAuth, redirects to Kakao
GET  /auth/kakao/callback    → Receives code from Kakao, creates session
GET  /auth/success           → Success page that closes the login window
POST /auth/exchange-token    → Exchanges temporary token for real JWT
```

### 2. **Tauri Window Management**

- Main window: Your app
- Login window: Ephemeral WebView for OAuth only
- Communication: URL monitoring + message passing

### 3. **Security**

- Temporary session tokens (5-minute expiration)
- Token exchange happens over HTTPS
- No credentials stored in frontend
- WebView is isolated from main app

---

## 🚀 Implementation Flow

### Step 1: User Clicks Login
Desktop app opens a new Tauri window with your backend's login URL

### Step 2: Web OAuth Flow
Standard web OAuth happens entirely in the WebView:
- Backend redirects to Kakao
- User logs in
- Kakao redirects back to backend
- Backend processes and creates session

### Step 3: Success Detection
Desktop app monitors the WebView URL for success page

### Step 4: Token Exchange
Desktop app exchanges temporary session token for real JWT

### Step 5: Cleanup
Login window closes, main app updates authenticated state

---

## 💡 Why This Works Better

1. **No custom URL schemes** - Everything uses standard HTTPS
2. **Backend-controlled** - All sensitive operations on server
3. **Platform-agnostic** - Same code works on all desktop platforms
4. **Secure** - Tokens never exposed to desktop environment
5. **Debuggable** - Standard web debugging tools work
6. **Reliable** - No OS-specific quirks or security blocks

---

## 🔒 Security Considerations

### Temporary Session Tokens
- Short-lived (5 minutes max)
- Single-use only
- Stored server-side with rate limiting
- Automatically cleaned up

### JWT Exchange
- Happens over HTTPS POST
- Requires valid session token
- Returns actual long-lived JWT
- Session token is invalidated after use

### WebView Isolation
- Separate window context
- No access to main app state
- Closes automatically after success
- No persistent cookies/storage

---

## 📋 Required Backend Endpoints

Your backend needs to implement:

```typescript
// 1. Start OAuth flow
GET /auth/kakao/start
→ Redirects to: https://kauth.kakao.com/oauth/authorize?client_id=...

// 2. Kakao callback
GET /auth/kakao/callback?code=XXX
→ Exchanges code for Kakao token
→ Gets user info
→ Creates user/session in database
→ Generates temporary session token
→ Redirects to: /auth/success?token=SESSION_TOKEN

// 3. Success page (HTML)
GET /auth/success?token=SESSION_TOKEN
→ Returns HTML page that desktop app can detect
→ Shows "Login successful, you can close this window"

// 4. Token exchange
POST /auth/exchange-token
Body: { sessionToken: "SESSION_TOKEN" }
→ Validates session token
→ Returns: { accessToken: "JWT", refreshToken: "...", user: {...} }
```

---

## 🎨 User Experience

### Good UX Flow:
1. User clicks "Login with Kakao" in desktop app
2. Small login window appears (600x700px)
3. Shows familiar Kakao login page
4. User logs in
5. "Login successful!" message appears
6. Window closes automatically
7. Main app shows logged-in state

### Compared to Deep Linking:
- ❌ Deep Link: Browser opens → User logs in → "Open Desktop Calendar?" dialog → User clicks Allow → App focuses → Login complete
- ✅ Web Flow: Login window opens → User logs in → Window closes → Done

Much smoother!

---

## 🛠️ Implementation Details

See the following files:
- `src/utils/oauth-web.ts` - WebView OAuth utilities
- `src/components/auth/LoginPage.tsx` - Updated login component
- `BACKEND_OAUTH_GUIDE.md` - Backend implementation guide

---

## 🆚 Comparison: Deep Link vs Web-Based

| Feature | Deep Link (Native) | Web-Based |
|---------|-------------------|-----------|
| Reliability | ⚠️ OS-dependent | ✅ Consistent |
| Setup Complexity | 🔴 High | 🟢 Low |
| Cross-platform | ⚠️ Different per OS | ✅ Same everywhere |
| Security | 🟡 URL schemes exposed | 🟢 Backend-controlled |
| User Experience | ⚠️ Extra dialog prompts | ✅ Seamless |
| Debugging | 🔴 Difficult | 🟢 Standard web tools |
| Kakao SDK | 🔴 Not desktop-friendly | 🟢 Web platform (official) |
| Production Ready | ⚠️ Requires testing per OS | ✅ Works out of box |

**Winner: Web-Based approach for desktop apps** ✅

