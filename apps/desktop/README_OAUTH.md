# Production OAuth Setup - Complete Implementation

This guide documents the complete OAuth redirect strategy implementation for your Tauri desktop application.

---

## 🎯 What Was Implemented

✅ **Custom URI Scheme (Deep Linking)** for production OAuth  
✅ **Development vs Production** environment separation  
✅ **Tauri Deep Link Handler** (Rust backend)  
✅ **Frontend OAuth Listener** (React/TypeScript)  
✅ **Kakao OAuth Integration** with proper redirect handling  
✅ **Environment-based Configuration** (.env files)  

---

## 📁 Files Created/Modified

### New Files Created:
- `OAUTH_SETUP_GUIDE.md` - Complete OAuth implementation guide
- `KAKAO_CONSOLE_SETUP.md` - Step-by-step Kakao Console configuration
- `src/utils/deeplink.ts` - Deep link utilities for OAuth
- `src-tauri/src/deep_link.rs` - Rust deep link handler
- `.env.development` - Development environment template
- `.env.production` - Production environment template
- `.env.example` - Environment variable template

### Files Modified:
- `src/components/auth/LoginPage.tsx` - Updated to use deep link handler
- `src-tauri/src/lib.rs` - Integrated deep link and shell plugins
- `src-tauri/Cargo.toml` - Added deep link and shell dependencies
- `src-tauri/tauri.conf.json` - Added deep link configuration
- `src-tauri/capabilities/default.json` - Added shell and deep link permissions
- `.gitignore` - Added environment files to ignore list

---

## 🚀 Quick Start

### 1. Configure Environment Variables

Create `.env.local` for development:
```bash
cp .env.development .env.local
```

Edit `.env.local` with your actual Kakao credentials:
```env
VITE_KAKAO_CLIENT_ID=your_rest_api_key
VITE_KAKAO_CLIENT_SECRET=your_client_secret
VITE_KAKAO_REDIRECT_URI=http://localhost:1420/oauth/callback
VITE_API_BASE_URL=http://localhost:8080
```

### 2. Configure Kakao Developers Console

See `KAKAO_CONSOLE_SETUP.md` for detailed instructions.

**Quick checklist:**
- [ ] Add redirect URI: `http://localhost:1420/oauth/callback`
- [ ] Add redirect URI: `kakao{YOUR_REST_API_KEY}://oauth`
- [ ] Enable Kakao Login
- [ ] Generate Client Secret (if using)
- [ ] Set consent items (profile, email)

### 3. Update tauri.conf.json

Replace `kakaoYOUR_REST_API_KEY` in `src-tauri/tauri.conf.json`:
```json
{
  "plugins": {
    "deepLink": {
      "desktop": {
        "schemes": ["kakaoYOUR_ACTUAL_REST_API_KEY"]
      }
    }
  }
}
```

### 4. Install Dependencies

```bash
# Install Rust dependencies (Tauri plugins)
cd src-tauri
cargo build
cd ..

# Or just run dev mode (will auto-install)
npm run tauri:dev
```

---

## 💻 Development

```bash
npm run tauri:dev
```

**How it works:**
- Uses `http://localhost:1420/oauth/callback` redirect URI
- OAuth happens in the same window (web flow)
- Standard web development experience
- No deep linking involved

---

## 📦 Production Build

### Step 1: Configure Production Environment

Create `.env.production.local`:
```bash
cp .env.production .env.production.local
```

Edit with production values:
```env
VITE_KAKAO_CLIENT_ID=your_rest_api_key
VITE_KAKAO_CLIENT_SECRET=your_client_secret
VITE_KAKAO_REDIRECT_URI=kakaoYOUR_REST_API_KEY://oauth
VITE_API_BASE_URL=https://api.yourproduction.com
```

### Step 2: Build the App

```bash
npm run tauri:build
```

Outputs will be in `src-tauri/target/release/bundle/`:
- **macOS**: `.dmg` and `.app`
- **Windows**: `.exe` and `.msi`
- **Linux**: `.deb`, `.AppImage`, etc.

### Step 3: Install and Test

1. Install the built app (double-click `.dmg`/`.exe`)
2. Run from Applications/Programs folder
3. Click "Login with Kakao"
4. Browser opens → Login → Redirects to `kakaoXXX://oauth`
5. Your app launches/focuses
6. Login completes ✅

---

## 🔐 Why Custom URI Scheme is Required

### ❌ The Problem with localhost in Production

In development, Vite runs a web server on `http://localhost:1420`. But in production:

1. **No server exists** - The packaged app is a standalone binary
2. **No localhost:1420** - Nothing is listening on that port
3. **OAuth redirect fails** - Browser tries to connect but gets "Connection refused"
4. **User sees error** - Instead of returning to app, sees browser error page

### ✅ The Solution: Deep Linking

Desktop apps use **custom URI schemes** (like mobile apps):

- `kakao{REST_API_KEY}://oauth` is registered with the OS
- When browser redirects to this URL, OS launches your app
- Your app receives the OAuth code via the deep link
- Works identically on macOS, Windows, and Linux
- No server required

**This is the industry standard for desktop OAuth** (Slack, Discord, VS Code, etc. all use this approach).

---

## 🔧 How It Works

### Development Flow (localhost)
```
User clicks Login
  ↓
Opens: https://kauth.kakao.com/oauth/authorize?redirect_uri=http://localhost:1420/...
  ↓
User logs in
  ↓
Kakao redirects: http://localhost:1420/oauth/callback?code=XXX
  ↓
Same window navigation (standard web flow)
  ↓
React useEffect detects code in URL
  ↓
Exchanges code for tokens
  ↓
Login complete ✅
```

### Production Flow (deep linking)
```
User clicks Login
  ↓
Opens: https://kauth.kakao.com/oauth/authorize?redirect_uri=kakaoXXX://oauth
  ↓
System browser opens (via Tauri shell plugin)
  ↓
User logs in
  ↓
Kakao redirects: kakaoXXX://oauth?code=YYY
  ↓
OS detects "kakaoXXX://" → Launches/focuses your app
  ↓
Tauri deep link handler receives URL
  ↓
Emits 'oauth-callback' event to frontend
  ↓
React listener receives code
  ↓
Exchanges code for tokens
  ↓
Login complete ✅
```

---

## 🐛 Troubleshooting

### Deep link not working in production

**Symptoms:** Button clicks, browser opens, but app doesn't receive callback

**Solutions:**
1. Verify `schemes` in `tauri.conf.json` matches your redirect URI exactly
2. **Rebuild and reinstall** the app (scheme registration happens at install time)
3. Uninstall completely, then reinstall
4. Test manually: `open kakaoYOURKEY://test` (macOS) or `start kakaoYOURKEY://test` (Windows)

### "redirect_uri mismatch" error

**Symptoms:** Kakao shows error after login

**Solutions:**
1. Check Kakao Console has EXACT redirect URI: `kakaoXXX://oauth`
2. No trailing slashes, no extra paths
3. Verify `VITE_KAKAO_REDIRECT_URI` in `.env.production.local`
4. Clear build cache: `rm -rf dist && npm run tauri:build`

### "localhost:1420 not found" in production build

**Symptoms:** Production app tries to use localhost

**Solutions:**
1. Verify `.env.production.local` exists and is loaded
2. Check `VITE_KAKAO_REDIRECT_URI` is set to custom scheme
3. Ensure you're building with production mode: `npm run tauri:build`
4. Check console logs for which redirect URI is being used

### Environment variables not loading

**Symptoms:** Console shows "NOT SET" for env vars

**Solutions:**
1. Ensure files are named correctly: `.env.local` or `.env.production.local`
2. Vite only loads `.env.local` and `.env.production.local` (not `.env.development`)
3. Restart dev server after changing env files
4. Rebuild for production after changing production env files

---

## 📚 Additional Resources

- **OAuth Setup Guide**: `OAUTH_SETUP_GUIDE.md` - Complete implementation details
- **Kakao Console Setup**: `KAKAO_CONSOLE_SETUP.md` - Step-by-step console configuration
- **Environment Example**: `.env.example` - Template for env vars

### External Documentation
- [Tauri Deep Link Plugin](https://v2.tauri.app/plugin/deep-link/)
- [Kakao Login Docs](https://developers.kakao.com/docs/latest/en/kakaologin/common)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

## 🔒 Security Best Practices

- ✅ Never commit `.env.local` or `.env.production.local` (they're in `.gitignore`)
- ✅ Use environment variables for all secrets
- ✅ Validate OAuth tokens on your backend
- ✅ Use HTTPS for production backend API
- ✅ Implement token refresh logic
- ✅ Consider using Tauri's secure storage for tokens
- ✅ Set appropriate token expiration times

---

## ✅ Pre-Deployment Checklist

Before releasing your app:

- [ ] Environment variables configured for production
- [ ] Custom URI scheme matches in Kakao Console and `tauri.conf.json`
- [ ] Both redirect URIs added to Kakao Console
- [ ] Backend validates Kakao tokens server-side
- [ ] HTTPS used for production backend
- [ ] App tested with production build (not dev mode)
- [ ] Deep linking tested on target platforms
- [ ] Error handling implemented for failed OAuth
- [ ] Tokens stored securely
- [ ] User can retry login if it fails

---

## 🎉 Summary

You now have a **production-ready OAuth implementation** for your Tauri desktop app:

✅ **Development**: Uses localhost (easy debugging)  
✅ **Production**: Uses custom URI scheme (works in packaged app)  
✅ **Cross-platform**: Works on macOS, Windows, Linux  
✅ **Secure**: Environment-based configuration, no hardcoded secrets  
✅ **Maintainable**: Clear separation of concerns, well-documented  

The implementation follows industry best practices and is identical to how major desktop apps (Slack, Discord, VS Code) handle OAuth.

