# 🔐 Environment Variables Setup Guide

## ✅ **SECURITY IMPROVEMENT**

Supabase credentials are now stored in Vercel environment variables instead of being hardcoded in the repository.

---

## 📋 **SETUP INSTRUCTIONS**

### Step 1: Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

#### For Production:
- **Name:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** `https://uayvdfmkjuxnfsoavwud.supabase.co`
- **Environment:** Production, Preview, Development

- **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVheXZkZm1ranV4bmZzb2F2d3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MzIzOTMsImV4cCI6MjA4MDUwODM5M30.dlWCOgRnGSDLHT21EWI1NZyfP0z0uFQpyYy1TlOpcCU`
- **Environment:** Production, Preview, Development

> **Note:** The `NEXT_PUBLIC_` prefix makes these variables available to the frontend during build time.

---

### Step 2: Local Development Setup

For local development, create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://uayvdfmkjuxnfsoavwud.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVheXZkZm1ranV4bmZzb2F2d3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MzIzOTMsImV4cCI6MjA4MDUwODM5M30.dlWCOgRnGSDLHT21EWI1NZyfP0z0uFQpyYy1TlOpcCU
```

> **Note:** `.env.local` is already in `.gitignore`, so it won't be committed.

---

## 🔧 **HOW IT WORKS**

### Build Process:

1. **Template File:** `js/eventhive-supabase.template.js`
   - Contains placeholders: `{{SUPABASE_URL}}` and `{{SUPABASE_ANON_KEY}}`
   - This file is committed to git (safe, no credentials)

2. **Build Script:** `build.js`
   - Runs during Vercel deployment
   - Reads environment variables
   - Replaces placeholders in template
   - Generates `js/eventhive-supabase.js` with actual credentials

3. **Output File:** `js/eventhive-supabase.js`
   - Generated during build
   - Contains actual credentials (not committed to git)
   - Used by the application at runtime

### Vercel Configuration:

- `vercel.json` includes `"buildCommand": "npm run build"`
- This ensures the build script runs before deployment
- Environment variables are injected during build

---

## ✅ **VERIFICATION**

### After Setting Up:

1. **Push to GitHub:**
   - The template file will be committed
   - The generated file is ignored (in `.gitignore`)

2. **Deploy to Vercel:**
   - Vercel will run `npm run build`
   - Build script will inject credentials from environment variables
   - Deployment will succeed

3. **Verify:**
   - Check Vercel build logs for: `✅ Supabase credentials injected successfully`
   - Test the deployed site to ensure Supabase connection works

---

## 🔒 **SECURITY NOTES**

### Why This Approach?

1. **No Credentials in Git:**
   - Template file has placeholders only
   - Generated file is git-ignored
   - Credentials only exist in Vercel environment variables

2. **Anon Key is Safe:**
   - The Supabase anon key is designed to be public
   - RLS (Row Level Security) policies protect your data
   - But it's still better practice to use environment variables

3. **Easy Rotation:**
   - Change credentials in Vercel dashboard
   - Redeploy (no code changes needed)

4. **Environment Separation:**
   - Different credentials for dev/staging/prod
   - Easy to manage per environment

---

## 🚨 **IMPORTANT**

### Before Pushing to Public Repository:

1. ✅ **Template file is safe** - Contains placeholders only
2. ✅ **Generated file is ignored** - Won't be committed
3. ✅ **Credentials in Vercel** - Not in repository
4. ⚠️ **Remove old credentials** - If you had them hardcoded, they're now in the template

### Current Status:

- ✅ `js/eventhive-supabase.template.js` - Safe to commit (placeholders)
- ✅ `js/eventhive-supabase.js` - Ignored (will be generated)
- ✅ `build.js` - Safe to commit (no credentials)
- ✅ `.gitignore` - Updated to ignore generated file

---

## 📝 **FILES CHANGED**

1. **Created:**
   - `build.js` - Build script for credential injection
   - `js/eventhive-supabase.template.js` - Template with placeholders
   - `package.json` - Added build script
   - `ENVIRONMENT_VARIABLES_SETUP.md` - This guide

2. **Updated:**
   - `vercel.json` - Added build command
   - `.gitignore` - Added generated file to ignore list

3. **To Be Generated:**
   - `js/eventhive-supabase.js` - Will be created during build (git-ignored)

---

## ✅ **READY TO DEPLOY**

After setting up environment variables in Vercel, you're ready to push to a public repository!

The credentials will be:
- ✅ Not in your git repository
- ✅ Securely stored in Vercel
- ✅ Injected during build
- ✅ Available only in the deployed application

