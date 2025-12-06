# ⚡ EventHive - Quick-Start Fix Guide (30 Minutes)

**Follow these steps IN ORDER to get EventHive working. Estimated time: 30 minutes.**

---

## STEP 1: Create Supabase Configuration File (5 minutes)

### 1a. Get Your Credentials
```
1. Go to https://supabase.com
2. Sign in
3. Open your EventHive project
4. Click "Settings" → "API"
5. Copy:
   - Project URL (looks like: https://xxxxx.supabase.co)
   - Anon/public key (starts with eyJ...)
```

### 1b. Create Configuration File
```
In your EventHive folder, create: js/eventhive-supabase.js

Copy the content from: js/eventhive-supabase.template.js

Then replace ONLY these two lines (4 and 5):
```

**BEFORE (in template):**
```javascript
const SUPABASE_URL = '{{SUPABASE_URL}}';
const SUPABASE_ANON_KEY = '{{SUPABASE_ANON_KEY}}';
```

**AFTER (your actual values):**
```javascript
const SUPABASE_URL = 'https://uayvdfmkjuxnfsoavwud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVheXZkZm1ranV4bmZzb2F2d3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MzIzOTMsImV4cCI6MjA4MDUwODM5M30.dlWCOgRnGSDLHT21EWI1NZyfP0z0uFQpyYy1TlOpcCU';
```

**Save the file.**

✅ Configuration complete!

---

## STEP 2: Create Admin User (3 minutes)

### 2a. Sign In to Your App
```
1. Open eventhive-homepage.html in browser
2. Click "Sign in with Google"
3. Use your TUP email (@tup.edu.ph)
4. Complete the signup process
```

### 2b. Make Yourself Admin
```
1. Go to Supabase Dashboard
2. Click "Authentication" → View users
3. Find your email in the list
4. Copy your UUID (looks like: 550e8400-e29b-41d4-a716-446655440000)
5. Go to "SQL Editor"
6. Paste and run this:

   UPDATE profiles
   SET is_admin = TRUE
   WHERE id = 'YOUR_UUID_HERE';

7. Replace YOUR_UUID_HERE with the UUID you copied
8. Click "Run"
```

**Verify it worked:**
```sql
SELECT email, is_admin FROM auth.users 
JOIN profiles ON auth.users.id = profiles.id;
```
You should see `is_admin = TRUE` for your email.

✅ Admin user created!

---

## STEP 3: Fix RLS Policies (5 minutes)

### 3a. Run the Fix SQL
Go to **SQL Editor** in Supabase and run this:

```sql
-- Drop old policy
DROP POLICY IF EXISTS "Admins can manage event images" ON event_images;

-- Create new policies
CREATE POLICY "Event images are viewable by everyone"
  ON event_images FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert event images"
  ON event_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update event images"
  ON event_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can delete event images"
  ON event_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );
```

Click **Run**.

✅ RLS policies fixed!

---

## STEP 4: Create Storage Bucket (5 minutes)

### 4a. Create Bucket
```
1. Go to Supabase Dashboard
2. Click "Storage"
3. Click "New bucket"
4. Name: event-images
5. Check "Make it public" (important!)
6. Click "Create"
```

### 4b. Set Storage Policies
In **Storage** → **event-images** → **Policies** tab, run:

```sql
-- Read policy (everyone can view)
CREATE POLICY "Anyone can view event images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-images');

-- Upload policy (admins only)
CREATE POLICY "Admins can upload event images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-images' 
    AND (
      SELECT profiles.is_admin 
      FROM profiles 
      WHERE profiles.id = auth.uid()
    ) = true
  );

-- Delete policy (admins only)
CREATE POLICY "Admins can delete event images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'event-images' 
    AND (
      SELECT profiles.is_admin 
      FROM profiles 
      WHERE profiles.id = auth.uid()
    ) = true
  );
```

✅ Storage bucket created!

---

## STEP 5: Test Everything (12 minutes)

### Test 1: Admin Dashboard Access
```
1. Sign in with your TUP email
2. Go to eventhive-admin.html
3. You should see the admin dashboard
4. If you see "Not authorized", you're not admin - go back to STEP 2
```

### Test 2: Create Pending Event
```
1. In admin dashboard, click "Add New Event" (+ button)
2. Fill in:
   - Title: "Test Event"
   - Description: "Testing the system"
   - Location: "TUP Manila"
   - Date/Time: Tomorrow, 9 AM - 5 PM
   - College: TUP
   - Organization: TUP USG Manila
3. Click "+ Add New Event"
```

### Test 3: Upload Images
```
1. Click the image icon for your new event
2. Click "Choose Files"
3. Select a JPG or PNG image
4. Click "Upload"
5. Image should appear in gallery
6. Click "Save"
```

**If you get RLS errors:**
- Double-check you're an admin (STEP 2)
- Verify storage bucket exists (STEP 4)
- Try again

### Test 4: Approve Event
```
1. Go to "Pending Events" tab
2. Click the check mark button to approve
3. Event should move to "Published Events" tab
4. Status should change to "Upcoming"
```

### Test 5: View Published Event
```
1. Go to eventhive-events.html
2. Your event should appear in the list
3. Click on it to see full details
4. Try to like and comment
```

### Test 6: Google OAuth
```
1. Sign out from your admin account
2. Try signing in with a non-TUP email
3. Should get an error message
4. Try with TUP email
5. Should work fine
```

---

## TROUBLESHOOTING

### Problem: "Supabase not initialized"
**Solution:**
```
1. Check that js/eventhive-supabase.js exists (not .template.js)
2. Verify credentials are correct
3. Open browser console (F12)
4. Run: getSupabaseClient()
5. Should show a client object, not null
```

### Problem: "Only admins can upload images"
**Solution:**
```
1. Verify you're admin:
   - Open browser console
   - Run: await checkIfUserIsAdmin()
   - Should return { success: true, isAdmin: true }

2. If not admin, you need to set is_admin = TRUE in database

3. If you already set it, wait 30 seconds and refresh browser
```

### Problem: "Bucket not found"
**Solution:**
```
1. Go to Supabase Storage
2. Check that "event-images" bucket exists
3. Check that it's PUBLIC (not private)
4. If missing, create it (STEP 4)
```

### Problem: "Cannot read property 'uid' of null"
**Solution:**
```
1. You need to be signed in to upload images
2. Sign out and sign in again
3. Or open eventhive-homepage.html first to trigger auth
```

### Problem: Image upload fails after several tries
**Solution:**
```
1. Check storage quota in Supabase Settings
2. Check if storage bucket has RLS policies (need to create them)
3. Try with a smaller image file
4. Check browser console for actual error message
```

---

## Quick Validation Checklist

After completing all 5 steps, verify:

- [ ] `js/eventhive-supabase.js` exists with real credentials
- [ ] You can log in with Google OAuth (TUP email)
- [ ] You're set as admin in Supabase
- [ ] Admin dashboard loads without errors
- [ ] Can create a pending event
- [ ] Can upload images to events
- [ ] Can approve pending events
- [ ] Approved events appear on eventhive-events.html
- [ ] Non-TUP emails are rejected during signup
- [ ] Can like/comment on published events

If all checkmarks are done: ✅ **EventHive is working!**

---

## Next Steps (After Getting It Working)

1. **Deploy to Vercel**
   - Push code to GitHub
   - Connect to Vercel
   - Set environment variables
   - Deploy

2. **Optimize for Production**
   - Implement Google Forms webhook (optional)
   - Set up CDN for images
   - Configure SSL certificates
   - Set up monitoring/logging

3. **Add More Features**
   - Event search/filtering
   - User notifications
   - Event calendar export
   - Social media sharing

---

## Emergency: Reset Everything

If something goes wrong and you need to start fresh:

```bash
# 1. Delete js/eventhive-supabase.js
rm js/eventhive-supabase.js

# 2. Go to Supabase Dashboard
# 3. Go to SQL Editor
# 4. Run: DELETE FROM events; DELETE FROM profiles;
# 5. Go to Storage and delete event-images bucket
# 6. Then start over from STEP 1
```

---

**You've got this! 🚀 EventHive will be running in 30 minutes.**

