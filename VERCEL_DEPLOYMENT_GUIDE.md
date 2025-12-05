# 🚀 Vercel Deployment Guide for EventHive Frontend

This guide will walk you through deploying your EventHive frontend to Vercel.

---

## 📋 **PREREQUISITES**

- [ ] GitHub account (recommended) or GitLab/Bitbucket
- [ ] Vercel account (free tier is fine)
- [ ] Your code pushed to a Git repository

---

## 🔧 **STEP 1: Prepare Your Repository**

### Option A: If you already have a GitHub repo
1. Make sure all your code is committed and pushed:
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

### Option B: If you need to create a GitHub repo
1. Go to [GitHub](https://github.com) and create a new repository
2. Initialize git in your project folder (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/EventHive.git
   git push -u origin main
   ```

---

## 🌐 **STEP 2: Sign Up / Log In to Vercel**

1. Go to [https://vercel.com](https://vercel.com)
2. Click **"Sign Up"** (or **"Log In"** if you have an account)
3. Sign up with GitHub (recommended) - this makes deployment easier

---

## 📦 **STEP 3: Deploy Your Project**

### Method 1: Import from GitHub (Recommended)

1. **Click "Add New Project"** on your Vercel dashboard
2. **Import your GitHub repository:**
   - Select your EventHive repository
   - Click **"Import"**

3. **Configure Project Settings:**
   - **Framework Preset:** Select **"Other"** or **"Vite"** (if you're using Vite) or leave as **"Other"**
   - **Root Directory:** Leave as `./` (root)
   - **Build Command:** Leave empty (static site, no build needed)
   - **Output Directory:** Leave empty (or set to `.` if needed)
   - **Install Command:** Leave empty

4. **Environment Variables (Optional for now):**
   - You can skip this for now since Supabase isn't configured yet
   - We'll add these later when setting up Supabase:
     - `NEXT_PUBLIC_SUPABASE_URL` (if needed)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (if needed)

5. **Click "Deploy"**

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Select your project settings
   - Deploy!

---

## ⚙️ **STEP 4: Configure Project Settings**

After initial deployment, you may need to adjust settings:

1. Go to your project dashboard on Vercel
2. Click **"Settings"**
3. **General Settings:**
   - **Framework Preset:** Other
   - **Build Command:** (leave empty - static site)
   - **Output Directory:** (leave empty)
   - **Install Command:** (leave empty)

4. **Root Directory:** (leave as `./`)

---

## 🔗 **STEP 5: Custom Domain (Optional)**

If you want a custom domain:

1. Go to **Settings** → **Domains**
2. Add your domain
3. Follow Vercel's DNS configuration instructions

---

## 📝 **STEP 6: Update File Paths (If Needed)**

Since Vercel serves from root, make sure your file paths are correct:

### Check These Files:
- `eventhive-homepage.html` - Links should be relative (e.g., `href="eventhive-events.html"`)
- `eventhive-events.html` - Script and CSS paths should be relative
- All HTML files - Ensure paths are relative, not absolute

### Example of Correct Paths:
```html
<!-- ✅ Correct (relative paths) -->
<link rel="stylesheet" href="css/eventhive-common.css">
<script src="js/eventhive-events.js"></script>
<a href="eventhive-homepage.html">Home</a>

<!-- ❌ Wrong (absolute paths) -->
<link rel="stylesheet" href="/css/eventhive-common.css">
<a href="/eventhive-homepage.html">Home</a>
```

---

## 🎯 **STEP 7: Test Your Deployment**

1. **Visit your Vercel URL:**
   - Format: `https://your-project-name.vercel.app`
   - Or your custom domain if configured

2. **Test all pages:**
   - [ ] Homepage loads correctly
   - [ ] Navigation works
   - [ ] Event cards display
   - [ ] Event details page works
   - [ ] Search page works
   - [ ] Profile page works
   - [ ] Admin dashboard works (will show local data until Supabase is set up)

3. **Check browser console:**
   - Open DevTools (F12)
   - Check for any 404 errors
   - Check for JavaScript errors

---

## ⚠️ **IMPORTANT NOTES FOR STATIC SITES**

### 1. **No Server-Side Routing**
Since this is a static site (HTML files), Vercel will serve them directly. Make sure:
- All links use `.html` extension (e.g., `eventhive-events.html`)
- Or configure redirects (see below)

### 2. **Single Page App Routing (Optional)**
If you want cleaner URLs without `.html`:

Create `vercel.json` in your root directory:
```json
{
  "rewrites": [
    {
      "source": "/",
      "destination": "/eventhive-homepage.html"
    },
    {
      "source": "/events",
      "destination": "/eventhive-events.html"
    },
    {
      "source": "/search",
      "destination": "/eventhive-search.html"
    },
    {
      "source": "/profile",
      "destination": "/eventhive-profile.html"
    },
    {
      "source": "/admin",
      "destination": "/eventhive-admin.html"
    },
    {
      "source": "/about",
      "destination": "/eventhive-aboutus.html"
    },
    {
      "source": "/contacts",
      "destination": "/eventhive-contacts.html"
    }
  ]
}
```

**Note:** If you use rewrites, update your internal links to not include `.html` extension.

---

## 🔄 **STEP 8: Continuous Deployment**

Vercel automatically deploys when you push to your main branch:

1. **Make changes locally**
2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. **Vercel automatically deploys** (usually takes 1-2 minutes)

---

## 🐛 **TROUBLESHOOTING**

### Issue: 404 Errors
**Solution:** Check file paths - make sure they're relative paths

### Issue: CSS/JS Not Loading
**Solution:** 
- Verify file paths in HTML
- Check browser console for 404 errors
- Ensure files are committed to Git

### Issue: Images Not Showing
**Solution:**
- Check image paths (should be relative)
- Ensure images folder is committed to Git
- Check file names (case-sensitive)

### Issue: Supabase Errors
**Solution:** 
- This is expected until Supabase is configured
- Functions will fallback to local data
- Add Supabase credentials later (see below)

---

## 🔐 **STEP 9: Add Environment Variables (Later)**

When you're ready to connect Supabase:

1. Go to **Settings** → **Environment Variables**
2. Add:
   - `SUPABASE_URL` = Your Supabase project URL
   - `SUPABASE_ANON_KEY` = Your Supabase anon key

3. **Update `js/eventhive-supabase.js`:**
   ```javascript
   // Option 1: Use environment variables (if using build process)
   const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
   
   // Option 2: Keep as is (for static site)
   // Vercel can inject env vars, but for client-side JS, you'll need to
   // either use a build step or keep them in the file
   ```

**Note:** For static sites, environment variables in Vercel won't automatically be available in client-side JavaScript. You have two options:
1. Keep credentials in the JS file (less secure, but works)
2. Use a build process to inject them
3. Use Vercel's environment variables with a build step

---

## 📊 **STEP 10: Monitor Your Deployment**

1. **Check Deployment Logs:**
   - Go to **Deployments** tab
   - Click on a deployment
   - View logs for any errors

2. **Check Analytics:**
   - Vercel provides basic analytics
   - View page views, visitors, etc.

3. **Check Function Logs:**
   - If using serverless functions (not needed for static site)

---

## ✅ **DEPLOYMENT CHECKLIST**

- [ ] Code pushed to GitHub
- [ ] Vercel account created
- [ ] Project imported to Vercel
- [ ] Initial deployment successful
- [ ] All pages load correctly
- [ ] Navigation works
- [ ] No console errors
- [ ] Images load correctly
- [ ] CSS styles applied correctly
- [ ] JavaScript functions work
- [ ] (Optional) Custom domain configured
- [ ] (Optional) Environment variables added (for Supabase)

---

## 🎉 **SUCCESS!**

Your frontend is now deployed! 

**Next Steps:**
1. Test thoroughly
2. Share your Vercel URL
3. Set up Supabase (when ready)
4. Add Supabase credentials
5. Test database integration

---

## 📚 **ADDITIONAL RESOURCES**

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Static Site Guide](https://vercel.com/docs/concepts/get-started/static)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**Need Help?**
- Check Vercel's documentation
- Check deployment logs for errors
- Verify all files are committed to Git
- Test locally first before deploying

