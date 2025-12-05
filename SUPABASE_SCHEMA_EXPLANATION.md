# Supabase Schema Explanation

## 📋 Overview

This document explains the EventHive Supabase database schema and how to use it.

---

## 🗄️ Database Tables

### 1. **`profiles` Table**
Stores user profile information that extends Supabase's `auth.users` table.

**Columns:**
- `id` (UUID, PRIMARY KEY) - References `auth.users(id)`, one-to-one relationship
- `username` (VARCHAR) - User's display username
- `full_name` (VARCHAR) - User's full name
- `avatar_url` (TEXT) - URL to user's profile picture
- `cover_photo_url` (TEXT) - URL to user's cover photo
- `bio` (TEXT) - User's bio/description
- **`is_admin` (BOOLEAN)** - **Admin/checker role flag** (default: `FALSE`)
- `created_at` (TIMESTAMP) - When profile was created
- `updated_at` (TIMESTAMP) - When profile was last updated

**Row Level Security (RLS) Policies:**
- ✅ Everyone can read profiles (public data)
- ✅ Users can update their own profile
- ✅ Users can insert their own profile (via trigger)

**Key Feature: Admin Role**
- The `is_admin` field determines if a user has admin/checker access
- Defaults to `FALSE` for all new users
- Must be manually set to `TRUE` in the database for admin users
- Used to show/hide the Dashboard link in the UI

---

### 2. **`event_likes` Table**
Junction table tracking which users liked which events.

**Columns:**
- `id` (UUID, PRIMARY KEY)
- `event_id` (UUID) - References events (will be added when events table is created)
- `user_id` (UUID) - References `auth.users(id)`
- `created_at` (TIMESTAMP) - When the like was created
- **UNIQUE constraint** on `(event_id, user_id)` - Prevents duplicate likes

**RLS Policies:**
- ✅ Everyone can read likes (public data)
- ✅ Authenticated users can like/unlike events

**Indexes:**
- `idx_event_likes_event_id` - Fast lookups by event
- `idx_event_likes_user_id` - Fast lookups by user
- `idx_event_likes_created_at` - Sorting by date

---

### 3. **`comments` Table**
Stores comments on events.

**Columns:**
- `id` (UUID, PRIMARY KEY)
- `event_id` (UUID) - References events (will be added when events table is created)
- `user_id` (UUID) - References `auth.users(id)`
- `content` (TEXT) - Comment text (max 200 chars, enforced by CHECK constraint)
- `created_at` (TIMESTAMP) - When comment was created
- `updated_at` (TIMESTAMP) - When comment was last updated

**RLS Policies:**
- ✅ Everyone can read comments (public data)
- ✅ Authenticated users can create comments
- ✅ Users can update their own comments
- ✅ Users can delete their own comments

**Indexes:**
- `idx_comments_event_id` - Fast lookups by event
- `idx_comments_user_id` - Fast lookups by user
- `idx_comments_created_at` - Sorting by date (oldest first)

---

## 🔧 Database Functions & Triggers

### 1. **`update_updated_at_column()` Function**
Automatically updates the `updated_at` timestamp when a row is modified.

**Applied to:**
- `profiles` table
- `comments` table

---

### 2. **`handle_new_user()` Function**
Automatically creates a profile when a new user signs up.

**What it does:**
- Extracts username from email or metadata
- Extracts full name from metadata
- Extracts avatar URL from metadata
- Sets `is_admin` to `FALSE` by default

**Trigger:**
- Fires `AFTER INSERT` on `auth.users` table

---

## 🔐 Admin/Checker Role Management

### How to Make a User an Admin

**Option 1: Via Supabase Dashboard (SQL Editor)**
```sql
-- Replace 'USER_EMAIL_HERE' with the admin's email
UPDATE profiles
SET is_admin = TRUE
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE'
);
```

**Option 2: Via Supabase Dashboard (Table Editor)**
1. Go to **Table Editor** → `profiles`
2. Find the user you want to make admin
3. Click the row to edit
4. Set `is_admin` to `TRUE`
5. Save

**Option 3: Via Supabase Dashboard (SQL Editor) - By User ID**
```sql
-- Replace 'USER_UUID_HERE' with the user's UUID
UPDATE profiles
SET is_admin = TRUE
WHERE id = 'USER_UUID_HERE';
```

### How to Check if User is Admin (JavaScript)

Add this function to `js/eventhive-supabase-services.js`:

```javascript
/**
 * Check if current user is an admin
 * @returns {Promise<{success: boolean, isAdmin: boolean, error?: string}>}
 */
async function checkIfUserIsAdmin() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, isAdmin: false, error: 'Supabase not initialized' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: true, isAdmin: false }; // Not logged in = not admin
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error checking admin status:', error);
      return { success: false, isAdmin: false, error: error.message };
    }

    return { success: true, isAdmin: data?.is_admin || false };
  } catch (error) {
    console.error('Unexpected error checking admin status:', error);
    return { success: false, isAdmin: false, error: error.message };
  }
}
```

### Update Frontend to Use Database Check

**In `js/eventhive-dropdownmenu.js`:**
```javascript
// Replace the hardcoded isChecker with database check
let isChecker = false; // Default to false

// Check admin status on page load
async function checkAdminStatus() {
  if (typeof checkIfUserIsAdmin === 'function') {
    const result = await checkIfUserIsAdmin();
    if (result.success) {
      isChecker = result.isAdmin;
      updateDashboardVisibility();
    }
  }
}

function updateDashboardVisibility() {
  const dashboardLink = document.getElementById('navDashboardBtn');
  if (dashboardLink) {
    dashboardLink.style.display = isChecker ? 'block' : 'none';
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', checkAdminStatus);
```

**In `js/eventhive-hamburger.js`:**
```javascript
// Update the function to check database
async function updateMobileMenuAuthState() {
  const loggedIn = (typeof isLoggedIn !== 'undefined') ? isLoggedIn : false;
  
  // Check admin status from database
  let isAdmin = false;
  if (typeof checkIfUserIsAdmin === 'function') {
    const result = await checkIfUserIsAdmin();
    if (result.success) {
      isAdmin = result.isAdmin;
    }
  }
  
  // ... rest of the function
}
```

---

## 📊 Database Relationships

```
auth.users (Supabase Auth)
    ↓ (1:1)
profiles
    ↓ (1:many)
event_likes (user_id)
comments (user_id)

events (to be created)
    ↓ (1:many)
event_likes (event_id)
comments (event_id)
```

---

## 🔍 Query Examples

### Get User Profile with Admin Status
```sql
SELECT id, username, full_name, avatar_url, is_admin
FROM profiles
WHERE id = 'USER_UUID_HERE';
```

### Get All Admins
```sql
SELECT id, username, full_name, email
FROM profiles
JOIN auth.users ON profiles.id = auth.users.id
WHERE is_admin = TRUE;
```

### Count Total Likes for an Event
```sql
SELECT COUNT(*) as like_count
FROM event_likes
WHERE event_id = 'EVENT_UUID_HERE';
```

### Get Comments for an Event (Oldest First)
```sql
SELECT 
  c.id,
  c.content,
  c.created_at,
  p.username,
  p.full_name,
  p.avatar_url
FROM comments c
JOIN profiles p ON c.user_id = p.id
WHERE c.event_id = 'EVENT_UUID_HERE'
ORDER BY c.created_at ASC;
```

---

## ✅ Summary

**Admin/Checker Role:**
- ✅ Stored in `profiles.is_admin` (BOOLEAN)
- ✅ Defaults to `FALSE` for all new users
- ✅ Must be manually set to `TRUE` in database
- ✅ Can be checked via `checkIfUserIsAdmin()` function
- ✅ Controls Dashboard link visibility in UI

**Next Steps:**
1. Run the updated schema SQL in Supabase
2. Add `checkIfUserIsAdmin()` function to services
3. Update frontend to use database check instead of hardcoded `isChecker`
4. Set admin users in database via SQL or dashboard

