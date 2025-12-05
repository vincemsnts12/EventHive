# ⚡ Quick Deploy to Vercel

## 🚀 Fastest Way (5 minutes)

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repo
4. Click **"Deploy"** (no build settings needed - it's a static site)
5. Done! 🎉

---

## 📝 What Vercel Will Do

- ✅ Automatically detect it's a static site
- ✅ Serve your HTML files
- ✅ Handle all routing
- ✅ Provide HTTPS
- ✅ Give you a URL like `your-project.vercel.app`

---

## ⚙️ Settings (Default is Fine)

- **Framework Preset:** Other
- **Build Command:** (empty)
- **Output Directory:** (empty)
- **Install Command:** (empty)

**That's it!** No build process needed.

---

## 🔗 Your URLs Will Be:

- Homepage: `https://your-project.vercel.app/eventhive-homepage.html`
- Events: `https://your-project.vercel.app/eventhive-events.html`
- Search: `https://your-project.vercel.app/eventhive-search.html`
- Profile: `https://your-project.vercel.app/eventhive-profile.html`
- Admin: `https://your-project.vercel.app/eventhive-admin.html`

---

## ✅ Test Checklist

After deployment, test:
- [ ] Homepage loads
- [ ] Navigation works
- [ ] Event cards show
- [ ] Clicking events works
- [ ] Search page works
- [ ] Profile page works
- [ ] Admin dashboard works (will use local data until Supabase is set up)

---

## 🐛 Common Issues

**404 Errors?**
- Check file paths are relative (they are ✅)
- Make sure all files are committed to Git

**CSS/JS not loading?**
- Check browser console (F12)
- Verify paths in HTML files

**Supabase errors?**
- Expected! Functions will use local data until Supabase is configured
- This is fine for now

---

## 📚 Full Guide

See `VERCEL_DEPLOYMENT_GUIDE.md` for detailed instructions.

---

**That's it! You're ready to deploy! 🚀**

