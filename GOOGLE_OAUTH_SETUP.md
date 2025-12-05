# 🔐 Google OAuth Setup Guide

## Step-by-Step Instructions

### Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project:**
   - Click the project dropdown at the top
   - Click "New Project" (or select existing)
   - Name it: "EventHive" (or your preferred name)
   - Click "Create"

3. **Enable Google+ API:**
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API" or "People API"
   - Click "Enable"

4. **Create OAuth 2.0 Credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, configure OAuth consent screen first:
     - User Type: **External** (for public use)
     - App name: **EventHive**
     - User support email: Your email
     - Developer contact: Your email
     - Click "Save and Continue"
     - Scopes: Click "Save and Continue" (default is fine)
     - Test users: Add your email, click "Save and Continue"
     - Click "Back to Dashboard"

5. **Create OAuth Client ID:**
   - Application type: **Web application**
   - Name: **EventHive Web Client**
   - Authorized redirect URIs: Add this URL:
     ```
     https://uayvdfmkjuxnfsoavwud.supabase.co/auth/v1/callback
     ```
   - Click "Create"
   - **IMPORTANT:** Copy the **Client ID** and **Client Secret** (you'll need these next)

---

### Step 2: Configure in Supabase

1. **In the Supabase Google OAuth screen:**
   - **Client IDs:** Paste your Google Client ID
     - Example format: `123456789-abcdefghijklmnop.apps.googleusercontent.com`
   - **Client Secret (for OAuth):** Paste your Google Client Secret
     - Example format: `GOCSPX-abcdefghijklmnopqrstuvwxyz`
   - **Skip nonce checks:** Leave OFF (default)
   - **Allow users without an email:** Leave OFF (default - you need emails)
   - **Callback URL:** Already filled in correctly:
     ```
     https://uayvdfmkjuxnfsoavwud.supabase.co/auth/v1/callback
     ```

2. **Click "Save"**

---

### Step 3: Verify Setup

1. **Test the OAuth flow:**
   - Go to your deployed site (or localhost)
   - Click "Sign in with Google"
   - You should be redirected to Google login
   - After logging in, you should be redirected back

2. **Check email domain restriction:**
   - Try logging in with a non-@tup.edu.ph email
   - It should be rejected (as per your code)
   - Only @tup.edu.ph emails should work

---

## 🔒 Security Notes

### Email Domain Restriction:
Your code already restricts sign-ups to `@tup.edu.ph` emails. This happens in:
- `js/eventhive-supabase.js` → `isAllowedEmailDomain()` function
- Users with non-TUP emails will be automatically signed out

### OAuth Consent Screen:
- For production, you'll need to verify your app with Google
- For testing, you can add test users in Google Cloud Console
- Go to "OAuth consent screen" → "Test users" → Add emails

---

## ⚠️ Common Issues

### Issue: "Redirect URI mismatch"
**Solution:**
- Make sure the redirect URI in Google Cloud Console exactly matches:
  ```
  https://uayvdfmkjuxnfsoavwud.supabase.co/auth/v1/callback
  ```
- No trailing slashes, exact match required

### Issue: "Client ID not found"
**Solution:**
- Double-check you copied the Client ID correctly
- Make sure you're using the Web Application client ID (not iOS/Android)

### Issue: "Access blocked"
**Solution:**
- If your app is in "Testing" mode, add test users in Google Cloud Console
- Go to "OAuth consent screen" → "Test users" → Add email addresses

---

## 📝 Quick Checklist

- [ ] Created Google Cloud Project
- [ ] Enabled Google+ API or People API
- [ ] Configured OAuth consent screen
- [ ] Created OAuth 2.0 Web Application credentials
- [ ] Added redirect URI to Google Cloud Console
- [ ] Copied Client ID and Client Secret
- [ ] Pasted credentials into Supabase
- [ ] Saved configuration
- [ ] Tested sign-in flow

---

## 🎯 What You Need

**From Google Cloud Console:**
- ✅ Client ID (looks like: `123456789-xxx.apps.googleusercontent.com`)
- ✅ Client Secret (looks like: `GOCSPX-xxx`)

**In Supabase:**
- ✅ Client IDs field: Paste Client ID
- ✅ Client Secret field: Paste Client Secret
- ✅ Callback URL: Already correct (don't change)

---

**Once you have the Client ID and Secret from Google Cloud Console, paste them into the Supabase form and click "Save"!**

