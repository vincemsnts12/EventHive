# EventHive Database Schema Review & Standardization

## Overview
This document reviews all data structures used in EventHive and provides recommendations for Supabase PostgreSQL database integration.

---

## 1. Events Data Structure

### Current Structure (`eventsData`)
```javascript
{
  'event-id': {
    title: string,              // Event title
    description: string,         // Full event description
    location: string,            // Event location/venue
    date: string,                // Formatted date string (e.g., "November 7, 2025 (Friday) | 12:00 NN - 4:00 PM")
    status: string,              // 'Upcoming' | 'Ongoing' | 'Concluded' | 'Pending'
    statusColor: string,         // 'upcoming' | 'ongoing' | 'concluded' | 'pending'
    isFeatured: boolean,         // Whether event appears in carousel
    likes: number,               // Total number of likes
    college: string,             // College code (e.g., 'COS', 'COE', 'TUP')
    collegeColor: string,        // CSS class color (e.g., 'cos', 'coe', 'tup')
    organization: string,        // Organization name
    images: string[],            // Array of image URLs
    universityLogo: string       // University logo URL
  }
}
```

### Issues Identified:
1. **Missing Database Fields:**
   - `id` (UUID) - Primary key
   - `created_at` (timestamp)
   - `updated_at` (timestamp)
   - `created_by` (UUID) - Foreign key to users table
   - `start_date` (timestamp) - For sorting/filtering
   - `end_date` (timestamp) - For status calculation
   - `start_time` (time)
   - `end_time` (time)

2. **Data Type Issues:**
   - `date` is a formatted string - should be split into `start_date`, `end_date`, `start_time`, `end_time`
   - `likes` is a number - should reference a `likes` junction table for user tracking
   - `images` is an array - PostgreSQL array or separate `event_images` table
   - `status` should be calculated from dates, not stored

3. **Inconsistencies:**
   - `pendingEventsData` missing `isFeatured` and `likes` fields
   - `statusColor` is redundant (can be derived from `status`)

---

## 2. Recommended Database Schema

### Table: `events`
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(500) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Upcoming', 'Ongoing', 'Concluded'
  is_featured BOOLEAN DEFAULT FALSE,
  college_code VARCHAR(10) NOT NULL, -- 'COS', 'COE', 'CAFA', 'CLA', 'CIE', 'TUP'
  organization_id UUID REFERENCES organizations(id),
  organization_name VARCHAR(255), -- Fallback if organization doesn't exist in table
  university_logo_url VARCHAR(500),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE, -- When admin approved (for pending events)
  approved_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_is_featured ON events(is_featured);
CREATE INDEX idx_events_college_code ON events(college_code);
CREATE INDEX idx_events_created_by ON events(created_by);
```

### Table: `event_images`
```sql
CREATE TABLE event_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_images_event_id ON event_images(event_id);
```

### Table: `event_likes`
```sql
CREATE TABLE event_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id) -- Prevent duplicate likes
);

CREATE INDEX idx_event_likes_event_id ON event_likes(event_id);
CREATE INDEX idx_event_likes_user_id ON event_likes(user_id);
```

### Table: `comments`
```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_event_id ON comments(event_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);
```

### Table: `colleges`
```sql
CREATE TABLE colleges (
  code VARCHAR(10) PRIMARY KEY, -- 'COS', 'COE', etc.
  name VARCHAR(255) NOT NULL,
  color_class VARCHAR(50) NOT NULL, -- 'cos', 'coe', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Table: `organizations`
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 3. Components Using Events Data

### Files That Reference `eventsData`:
1. **`js/eventhive-events.js`** - Main events data source
   - Defines `eventsData` object
   - Used for event details page
   - Handles event selection and navigation

2. **`js/eventhive-carousel.js`** - Hero carousel
   - Filters `eventsData` for `isFeatured: true`
   - Builds carousel slides dynamically

3. **`js/eventhive-admin.js`** - Admin dashboard
   - Uses `eventsData` for published events table
   - Uses `pendingEventsData` for pending events table
   - Handles CRUD operations (currently local only)

4. **`js/eventhive-profile-liked.js`** - Profile liked events
   - Renders liked events from `eventsData`
   - Should filter by user's liked events from database

5. **`eventhive-homepage.html`** - Homepage event listings
   - "Top Events Today" (top 3 by likes)
   - "Up-and-Coming Events"
   - "Completed Events"

---

## 4. Migration Strategy

### Phase 1: Data Structure Standardization
- [ ] Add missing fields to `eventsData` objects
- [ ] Standardize date format (split into start_date, end_date, times)
- [ ] Add default values for `isFeatured` and `likes` in pending events
- [ ] Create helper functions to convert between frontend format and database format

### Phase 2: Database Integration
- [ ] Create Supabase tables (events, event_images, event_likes, comments, colleges, organizations)
- [ ] Create Supabase functions for:
  - `get_events(status, limit, offset)` - Fetch events with filters
  - `get_featured_events()` - Get featured events for carousel
  - `get_event_by_id(id)` - Get single event details
  - `get_event_likes_count(event_id)` - Count likes for an event
  - `toggle_event_like(event_id, user_id)` - Like/unlike an event
  - `get_comments(event_id)` - Get comments for an event (oldest first)
  - `create_comment(event_id, user_id, content)` - Add a comment

### Phase 3: Frontend Updates
- [ ] Replace `eventsData` object with Supabase queries
- [ ] Update all components to use async data fetching
- [ ] Add loading states
- [ ] Add error handling
- [ ] Implement real-time updates for likes and comments

### Phase 4: Admin Dashboard
- [ ] Connect admin CRUD operations to Supabase
- [ ] Implement approval workflow for pending events
- [ ] Add organization management
- [ ] Add college management

---

## 5. Data Transformation Functions Needed

### Frontend → Database
```javascript
function eventToDatabase(event) {
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    start_date: parseDateString(event.date).start,
    end_date: parseDateString(event.date).end,
    is_featured: event.isFeatured || false,
    college_code: event.college,
    organization_name: event.organization,
    university_logo_url: event.universityLogo,
    images: event.images // Will be inserted into event_images table
  };
}
```

### Database → Frontend
```javascript
function eventFromDatabase(dbEvent, images, likesCount) {
  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description,
    location: dbEvent.location,
    date: formatDateRange(dbEvent.start_date, dbEvent.end_date),
    status: calculateStatus(dbEvent.start_date, dbEvent.end_date),
    statusColor: getStatusColor(dbEvent.status),
    isFeatured: dbEvent.is_featured,
    likes: likesCount,
    college: dbEvent.college_code,
    collegeColor: getCollegeColor(dbEvent.college_code),
    organization: dbEvent.organization_name,
    images: images.map(img => img.image_url),
    universityLogo: dbEvent.university_logo_url
  };
}
```

---

## 6. Status Calculation Logic

```javascript
function calculateStatus(startDate, endDate) {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (now < start) return 'Upcoming';
  if (now >= start && now <= end) return 'Ongoing';
  if (now > end) return 'Concluded';
  return 'Pending'; // Default for unapproved events
}
```

---

## 7. Comments Structure

### Current (Hardcoded in HTML):
- User avatar (image URL)
- User name (link to profile)
- Comment text
- Timestamp (relative, e.g., "1 day ago")

### Database Structure:
- `id` (UUID)
- `event_id` (UUID) - Foreign key
- `user_id` (UUID) - Foreign key to auth.users
- `content` (TEXT, max 200 chars)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Frontend Display:
- Fetch user profile (name, avatar) from `profiles` table
- Calculate relative timestamp client-side
- Order by `created_at ASC` (oldest first)

---

## 8. Action Items

### Immediate:
1. ✅ Standardize `eventsData` structure across all components
2. ✅ Add missing fields (`isFeatured`, `likes`) to pending events
3. ⏳ Create date parsing/formatting utility functions
4. ⏳ Document all data transformations

### Short-term:
1. ⏳ Create Supabase schema
2. ⏳ Set up Supabase client in frontend
3. ⏳ Create API functions for events CRUD
4. ⏳ Migrate carousel to use database
5. ⏳ Migrate event cards to use database

### Long-term:
1. ⏳ Implement real-time updates (likes, comments)
2. ⏳ Add caching layer
3. ⏳ Optimize queries with proper indexes
4. ⏳ Add pagination for event listings
5. ⏳ Implement search functionality

---

## 9. Notes

- **Date Format**: Currently using formatted strings. Need to standardize to ISO 8601 for database storage.
- **Likes**: Currently a number. Should be a count from `event_likes` table with user tracking.
- **Images**: Currently an array. Should be stored in `event_images` table with ordering.
- **Status**: Should be calculated from dates, not stored (except 'Pending' which is approval status).
- **Comments**: Currently hardcoded. Need full CRUD implementation with database.
- **User Data**: Need `profiles` table for user avatars, names, etc.

---

## 10. Testing Checklist

- [ ] All events display correctly from database
- [ ] Carousel shows only featured events
- [ ] Event cards show correct data (title, image, likes, college tag)
- [ ] Event details page loads correct event
- [ ] Likes count updates correctly
- [ ] Comments display in correct order (oldest first)
- [ ] Comments can be created
- [ ] Admin dashboard can approve/reject events
- [ ] Admin dashboard can edit events
- [ ] Mobile touch-and-hold scrolling works
- [ ] Title scrolling works on hover (desktop) and hold (mobile)

