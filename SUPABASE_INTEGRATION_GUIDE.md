# Supabase Integration Guide

This guide explains how to set up and use the Supabase integration for EventHive.

## 📋 Overview

The Supabase integration handles:
- **Likes**: Users can like/unlike events, with counts tracked in the database
- **Comments**: Users can post comments on events (max 200 chars), displayed oldest first
- **User Profiles**: User profile data stored in Supabase (avatar, bio, etc.)

## 🗄️ Database Setup

### Step 1: Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the database to initialize

### Step 2: Run SQL Schema
1. Open the SQL Editor in your Supabase dashboard
2. Copy and paste the contents of `supabase-schema.sql`
3. Run the SQL script

This will create:
- `profiles` table (user profiles)
- `event_likes` table (like tracking)
- `comments` table (event comments)
- Row Level Security (RLS) policies
- Triggers for auto-creating profiles on signup

### Step 3: Get API Credentials
1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy your:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### Step 4: Configure Frontend
1. Open `js/eventhive-supabase.js`
2. Replace the placeholder values:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Replace with your project URL
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your anon key
   ```

## 📁 Files Created/Modified

### New Files:
1. **`supabase-schema.sql`** - Database schema (run in Supabase SQL Editor)
2. **`js/eventhive-supabase-services.js`** - Service functions for database operations
3. **`js/eventhive-comments-likes.js`** - Frontend integration for comments and likes
4. **`SUPABASE_INTEGRATION_GUIDE.md`** - This guide

### Modified Files:
1. **`eventhive-events.html`** - Added Supabase scripts and removed hardcoded comments
2. **`js/eventhive-events.js`** - Added initialization for comments/likes

## 🔧 How It Works

### Comments Flow:
1. User types comment (max 200 chars)
2. Clicks send button or presses Enter
3. `createComment()` sends to Supabase
4. Comments list refreshes automatically
5. Comments display oldest first with user avatars/names

### Likes Flow:
1. User clicks heart button
2. `toggleEventLike()` checks if already liked
3. If liked → unlike (delete from database)
4. If not liked → like (insert into database)
5. Like count updates automatically
6. Button state reflects user's like status

### Profile Flow:
1. User signs up → Trigger creates profile automatically
2. Profile data fetched from `profiles` table
3. Avatar displayed in comment input
4. Profile page can update profile data

## 🎯 Next Steps

### 1. Update Like Buttons Across Site
The like buttons on event cards (homepage, search, carousel, profile) need to be updated to use Supabase. Currently they only toggle CSS classes.

**Files to update:**
- `js/eventhive-carousel.js`
- `js/eventhive-dropdown-searchbar.js`
- `js/eventhive-profile-liked.js`

**Example integration:**
```javascript
likeButton.addEventListener('click', async (e) => {
  e.stopPropagation();
  const result = await toggleEventLike(eventId);
  if (result.success) {
    likeButton.classList.toggle('active', result.liked);
    // Update like count display
  }
});
```

### 2. Update Profile Page
The profile page (`eventhive-profile.html`) currently uses localStorage. Update it to:
- Fetch profile from Supabase on load
- Save profile updates to Supabase
- Display user's liked events from database

**File to update:** `js/eventhive-profile.js`

### 3. Update Liked Events Section
The "Liked Post" section should fetch events the user has liked from Supabase.

**File to update:** `js/eventhive-profile-liked.js`

**Example:**
```javascript
const { success, eventIds } = await getUserLikedEventIds();
if (success) {
  // Filter eventsData to only show liked events
  const likedEvents = eventIds.map(id => eventsData[id]).filter(Boolean);
  renderLikedEvents(likedEvents);
}
```

### 4. Add Real-time Updates (Optional)
Supabase supports real-time subscriptions. You can add:
- Real-time comment updates (new comments appear automatically)
- Real-time like count updates

**Example:**
```javascript
const subscription = supabase
  .from('comments')
  .on('INSERT', (payload) => {
    // Add new comment to UI
  })
  .subscribe();
```

## 🔐 Security Notes

- Row Level Security (RLS) is enabled on all tables
- Users can only update/delete their own comments
- Users can only update their own profiles
- All users can read profiles, comments, and likes (public data)

## 🐛 Troubleshooting

### Comments not loading?
- Check browser console for errors
- Verify Supabase credentials are correct
- Check RLS policies are set correctly
- Ensure `event_id` matches your event IDs

### Likes not working?
- Verify user is authenticated (`getCurrentUser()`)
- Check `event_likes` table has correct `event_id` format
- Ensure RLS policies allow INSERT/DELETE for authenticated users

### Profile not created on signup?
- Check trigger `on_auth_user_created` exists
- Verify trigger function `handle_new_user()` is created
- Check Supabase logs for errors

## 📚 API Reference

### Like Functions:
- `toggleEventLike(eventId)` - Toggle like/unlike
- `getEventLikeCount(eventId)` - Get total likes
- `hasUserLikedEvent(eventId)` - Check if user liked
- `getUserLikedEventIds()` - Get all event IDs user liked

### Comment Functions:
- `getEventComments(eventId)` - Get all comments for event
- `createComment(eventId, content)` - Create new comment
- `deleteComment(commentId)` - Delete comment

### Profile Functions:
- `getUserProfile(userId)` - Get user profile
- `updateUserProfile(profileData)` - Update profile
- `getCurrentUser()` - Get current authenticated user

## ✅ Testing Checklist

- [ ] Database schema created successfully
- [ ] Supabase credentials configured
- [ ] Comments load on event details page
- [ ] Can post new comments
- [ ] Like count displays correctly
- [ ] Can like/unlike events
- [ ] User avatar displays in comment input
- [ ] Profile page loads user data
- [ ] Liked events section shows correct events

