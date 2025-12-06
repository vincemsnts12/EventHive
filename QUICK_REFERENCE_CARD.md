# 🎯 EventHive - Quick Reference Card

## The 9 Critical Issues (One-Page Summary)

| # | Problem | Cause | Fix Time | Location |
|---|---------|-------|----------|----------|
| 1 | **No Credentials** | Template file never filled | 5 min | QUICK_START_FIX_GUIDE.md - STEP 1 |
| 2 | **RLS Too Strict** | Wrong policy blocking uploads | 5 min | SUPABASE_SQL_FIXES.md - FIX 1 |
| 3 | **No Storage Bucket** | Never created in Supabase | 5 min | QUICK_START_FIX_GUIDE.md - STEP 4 |
| 4 | **OAuth Callback Wrong** | Using dynamic URLs instead of static | 15 min | AUTHENTICATION_DEEP_DIVE.md - ISSUE 1 |
| 5 | **No Admin Users** | Never set is_admin=TRUE | 3 min | QUICK_START_FIX_GUIDE.md - STEP 2 |
| 6 | **Schema Incomplete** | Missing triggers & audit tables | 10 min | SUPABASE_SQL_FIXES.md - FIX 3-7 |
| 7 | **OAuth Unverified** | App in Testing mode | 5 min | AUTHENTICATION_DEEP_DIVE.md - ISSUE 2 |
| 8 | **Email Check Broken** | Happens after user signed in | 15 min | AUTHENTICATION_DEEP_DIVE.md - ISSUE 3 |
| 9 | **Build Not Deployed** | Env vars never set in Vercel | 10 min | COMPREHENSIVE_ANALYSIS_AND_FIXES.md - PROBLEM 8 |

---

## 30-Minute Fix Checklist

```
□ 5 min: Create js/eventhive-supabase.js with real credentials
   Location: js/ folder, copy from template, fill in values
   
□ 3 min: Sign in to app via Google OAuth
   Go to eventhive-homepage.html, click "Sign in with Google"
   
□ 3 min: Make yourself admin
   Supabase → SQL Editor → UPDATE profiles SET is_admin = TRUE WHERE id = 'YOUR_UUID'
   
□ 5 min: Fix RLS policies
   Supabase → SQL Editor → Run the SQL from SUPABASE_SQL_FIXES.md - FIX 1
   
□ 5 min: Create storage bucket
   Supabase → Storage → New bucket → event-images → Public
   
□ 1 min: Configure storage policies
   Run SQL from SUPABASE_SQL_FIXES.md in Storage SQL Editor
   
□ 3 min: Test admin dashboard
   Go to eventhive-admin.html, create test event
   
□ 5 min: Test image upload
   Admin dashboard → Edit event → Images → Upload → Should work!
   
✅ DONE! EventHive is working
```

---

## Command Quick Reference

### Get Your Supabase Credentials
```
1. Go to https://supabase.com
2. Sign in to your project
3. Settings → API
4. Copy: Project URL and anon/public key
5. Paste into js/eventhive-supabase.js
```

### Make Yourself Admin
```sql
-- In Supabase SQL Editor, paste:
UPDATE profiles
SET is_admin = TRUE
WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@tup.edu.ph');
```

### Verify Admin Status
```sql
SELECT email, is_admin FROM auth.users 
JOIN profiles ON auth.users.id = profiles.id;
```

### Fix RLS Policies
```
See: SUPABASE_SQL_FIXES.md - FIX 1
Copy entire SQL block and run in Supabase SQL Editor
```

### Create Storage Bucket
```
Supabase Dashboard → Storage → New bucket
Name: event-images
Make it PUBLIC
Click Create
```

### Clear Cache If Issues
```
Browser: Ctrl+Shift+Delete (open DevTools Cache storage)
Delete all EventHive entries
Refresh page
```

---

## Error Messages & Quick Fixes

| Error | Meaning | Fix |
|-------|---------|-----|
| "Supabase not initialized" | Credentials missing | Fill in js/eventhive-supabase.js |
| "New row violates row-level security policy" | RLS blocking insert | Run FIX 1 in SUPABASE_SQL_FIXES.md |
| "Bucket not found" | Storage bucket missing | Create event-images bucket (STEP 4) |
| "Only admins can..." | You're not admin | Set is_admin = TRUE in database |
| "Redirect URI mismatch" | OAuth callback wrong | Fix OAuth configuration in AUTHENTICATION_DEEP_DIVE |
| "Email domain not allowed" | Not @tup.edu.ph | Use TUP email to sign in |
| "Access blocked - testing mode" | Google app unverified | Add yourself as test user in Google Console |
| "Cannot read uid of null" | Not signed in | Go to homepage and sign in first |

---

## File Quick Lookup

| Need | File | Section |
|------|------|---------|
| Get started ASAP | QUICK_START_FIX_GUIDE.md | STEP 1-5 |
| Understand all issues | COMPREHENSIVE_ANALYSIS_AND_FIXES.md | PROBLEM 1-9 |
| SQL fixes | SUPABASE_SQL_FIXES.md | FIX 1-10 |
| Auth problems | AUTHENTICATION_DEEP_DIVE.md | ISSUE 1-6 |
| This quick ref | EVENTHIVE_ISSUE_SUMMARY.md | Overview |

---

## Browser Console Debugging

```javascript
// In browser F12 console, paste these:

// Test Supabase connection:
getSupabaseClient()
// Should show client object, not null

// Check if signed in:
await getSupabaseClient().auth.getUser()
// Should show user object

// Check if admin:
await checkIfUserIsAdmin()
// Should show { success: true, isAdmin: true }

// Check current session:
await getSupabaseClient().auth.getSession()
// Should show session with user data

// Test storage access:
await getSupabaseClient().storage.from('event-images').list()
// Should work if bucket exists and RLS allows
```

---

## Production Checklist

Before deploying to Vercel:

```
Infrastructure:
✅ Supabase project created
✅ Database schema imported
✅ Storage bucket created
✅ RLS policies configured
✅ Admin user set up
✅ Google OAuth credentials created

Configuration:
✅ js/eventhive-supabase.js with real credentials
✅ Vercel environment variables set:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ build.js verified and tested
✅ vercel.json configured

Testing:
✅ Sign in with Google works
✅ Non-TUP emails rejected
✅ Admin can create events
✅ Images upload successfully
✅ Published events appear on homepage
✅ Likes/comments work

Deployment:
✅ Code pushed to GitHub
✅ Vercel connected to repo
✅ Environment variables added
✅ Build logs show "✅ Credentials injected"
✅ Site deployed successfully
✅ Final testing on production URL
```

---

## Key Credentials (Example Format)

```
SUPABASE_URL: https://xxxxx.supabase.co

SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...

GOOGLE_CLIENT_ID: 123456789-abcdefghijklmnop.apps.googleusercontent.com

GOOGLE_CLIENT_SECRET: GOCSPX-abcdefghijklmnopqrstuvwxyz
```

---

## Test Cases (Do These to Verify Everything Works)

```
TEST 1: Authentication
□ Sign in with TUP email → Success
□ Sign in with non-TUP email → Error
□ Sign out → Works
□ Refresh page → Stay signed in

TEST 2: Admin Features
□ Access admin dashboard → Works
□ Create pending event → Works
□ Edit event → Works
□ Delete event → Works
□ Approve pending event → Works
□ Reject pending event → Works

TEST 3: Images
□ Upload image → Works
□ Delete image → Works
□ Set as thumbnail → Works
□ Image appears in gallery → Works
□ No "RLS policy" errors → IMPORTANT

TEST 4: User Features
□ View published events → Works
□ Like/unlike event → Works
□ Comment on event → Works
□ View likes count → Accurate
□ View comments → Newest first

TEST 5: Edge Cases
□ Create event with special characters → Works
□ Upload very large image → Rejected (>5MB)
□ Upload non-image file → Rejected
□ Try to upload without being admin → Error
□ Try to delete other user's event → Error

All green ✅ = Ready for production
```

---

## Common "Gotchas"

🚫 **Don't forget to...**
- Save js/eventhive-supabase.js after filling in credentials
- Make storage bucket PUBLIC (not private)
- Add RLS policies after creating bucket
- Verify you're admin before trying to upload
- Use your full UUID when setting is_admin, not just email
- Add yourself to Google OAuth test users
- Replace placeholder values (not just {{}})
- Test on actual device/network (not just localhost)

🚫 **Don't do...**
- Commit js/eventhive-supabase.js to git (has credentials!)
- Use {{}} placeholders in production
- Make database credentials public
- Use non-TUP emails for critical admin accounts
- Disable RLS entirely (security risk)
- Share your Supabase keys in Slack/email
- Test with test@gmail.com if you want TUP-only

---

## Time Estimates

| Task | Time | Difficulty |
|------|------|-----------|
| Get credentials | 5 min | 🟢 Easy |
| Create js/eventhive-supabase.js | 5 min | 🟢 Easy |
| Sign in and make admin | 8 min | 🟢 Easy |
| Fix RLS policies | 5 min | 🟡 Medium |
| Create storage bucket | 5 min | 🟢 Easy |
| Test everything | 12 min | 🟢 Easy |
| **TOTAL TO WORKING** | **40 min** | **🟢 Easy** |
| Deploy to Vercel | 15 min | 🟡 Medium |
| **TOTAL TO PRODUCTION** | **55 min** | **🟡 Medium** |

---

## Success Indicators

🟢 **It's working when you see:**
- No red errors in browser console
- Admin dashboard loads
- Can create/edit/delete events
- Images upload without "RLS" errors
- Events appear on homepage
- Non-TUP emails get rejected
- Like/comment features work

🔴 **It's NOT working if you see:**
- "Supabase not initialized"
- "Row-level security policy" errors
- "Bucket not found"
- "Only admins can..." message (when you ARE admin)
- Admin dashboard won't load
- Can't upload images

---

## Emergency: Reset Everything

If you mess up and want to start over:

```bash
# 1. Delete the config file
rm js/eventhive-supabase.js

# 2. Go to Supabase and run:
DELETE FROM events;
DELETE FROM profiles;
DELETE FROM organizations;
DELETE FROM colleges WHERE code NOT IN ('COS','COE','CAFA','CLA','CIE','CIT','TUP');

# 3. Delete storage bucket:
# Go to Supabase Storage → event-images → Delete bucket

# 4. Start fresh from STEP 1 of QUICK_START_FIX_GUIDE.md
```

---

## Getting Help

**Problem?** Check in this order:

1. Look at error message → Search it in browser
2. Check **Troubleshooting** section relevant to your issue
3. Look up error in this quick reference table
4. Read detailed explanation in COMPREHENSIVE_ANALYSIS_AND_FIXES.md
5. Check browser console (F12) for actual error
6. Check Supabase logs (Dashboard → Logs)
7. Review Google OAuth configuration
8. Re-read the relevant documentation file

**Still stuck?** Re-do the step that's failing from the beginning.

---

## One-Line Quick Ref

| Situation | Action |
|-----------|--------|
| Can't sign in | Get credentials from Supabase, fill in js/eventhive-supabase.js |
| RLS errors uploading | Run FIX 1 from SUPABASE_SQL_FIXES.md |
| Storage not found | Create event-images bucket in Supabase Storage |
| Not admin | UPDATE profiles SET is_admin = TRUE WHERE id = 'UUID' |
| OAuth redirects wrong | Read AUTHENTICATION_DEEP_DIVE.md - ISSUE 1 |
| Non-TUP users can sign up | Implement email check from AUTHENTICATION_DEEP_DIVE.md - ISSUE 3 |

---

## Final Tip

**The most common mistake:** Forgetting to save js/eventhive-supabase.js after filling in credentials.

**The most common error:** "Supabase not initialized" = you didn't do the above.

**The fastest fix:** Follow QUICK_START_FIX_GUIDE.md exactly in order.

---

**You're ready!** 🚀 Now go make EventHive work!

