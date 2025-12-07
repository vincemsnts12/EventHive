# SMTP Providers That Work Without Domain Verification

Since Resend requires domain ownership and `tup-eventhive.vercel.app` is a Vercel subdomain (not owned by you), here are SMTP providers that work without domain verification or offer test domains.

## 🎯 Best Options for Your Situation

### Option 1: Brevo (Sendinblue) - **RECOMMENDED**
**Why it's best**: Highest free tier (300 emails/day), easy setup, works with test domain

#### Setup Steps:

1. **Sign up at [brevo.com](https://brevo.com)**
   - Free account, no credit card needed
   - Verify your email

2. **Get SMTP Credentials**:
   - Go to **SMTP & API** → **SMTP**
   - You'll see your SMTP settings:
     - **Server**: `smtp-relay.brevo.com`
     - **Port**: `587`
     - **Login**: Your Brevo account email
     - **Password**: Your SMTP key (click "Generate" if needed)

3. **Verify Sender Email** (Optional but Recommended):
   - Go to **Senders** → **Add a sender**
   - Add your personal email (e.g., your TUP email)
   - Verify via email link
   - This becomes your "from" address

4. **Configure in Supabase**:
   ```
   Host: smtp-relay.brevo.com
   Port: 587
   Username: [Your Brevo account email]
   Password: [Your Brevo SMTP key]
   Sender email: [Your verified sender email]
   Sender name: EventHive
   ```

**Free Tier**: 300 emails/day (9,000/month) - **Best free tier available!**

---

### Option 2: SendGrid
**Why it works**: Allows using their domain, reliable service

#### Setup Steps:

1. **Sign up at [sendgrid.com](https://sendgrid.com)**
   - Free account, verify email

2. **Verify Single Sender**:
   - Go to **Settings** → **Sender Authentication**
   - Click **Verify a Single Sender**
   - Add your email (e.g., your TUP email)
   - Verify via email link

3. **Create API Key**:
   - Go to **Settings** → **API Keys**
   - Click **Create API Key**
   - Name it "EventHive SMTP"
   - Select **Full Access** or **Restricted Access** (Mail Send)
   - Copy the API key

4. **Configure in Supabase**:
   ```
   Host: smtp.sendgrid.net
   Port: 587
   Username: apikey
   Password: [Your SendGrid API Key]
   Sender email: [Your verified sender email]
   Sender name: EventHive
   ```

**Free Tier**: 100 emails/day (3,000/month)

---

### Option 3: Mailgun
**Why it works**: Good free trial, allows test domain

#### Setup Steps:

1. **Sign up at [mailgun.com](https://mailgun.com)**
   - Free trial: 5,000 emails/month for 3 months
   - Then paid plans

2. **Use Test Domain** (No verification needed):
   - Mailgun provides a test domain like `sandbox[random].mailgun.org`
   - Go to **Sending** → **Domain Settings**
   - Use the default sandbox domain
   - Or verify your own domain (if you have one)

3. **Get SMTP Credentials**:
   - Go to **Sending** → **Domain Settings** → Your domain
   - Click **SMTP credentials**
   - Copy the SMTP username and password

4. **Configure in Supabase**:
   ```
   Host: smtp.mailgun.org
   Port: 587
   Username: [Your Mailgun SMTP username]
   Password: [Your Mailgun SMTP password]
   Sender email: postmaster@[your-mailgun-domain].mailgun.org
   Sender name: EventHive
   ```

**Free Tier**: 5,000 emails/month (first 3 months), then paid

---

### Option 4: Use Resend's Test Domain (Simplest)
**Why it works**: You already have Resend set up, just use their test domain

#### Setup Steps:

1. **In Resend Dashboard**:
   - Go to **Domains**
   - You'll see a default domain like `onboarding.resend.dev`
   - **Don't try to add a new domain** - just use this one!

2. **Configure in Supabase**:
   ```
   Host: smtp.resend.com
   Port: 587
   Username: resend
   Password: [Your Resend API Key]
   Sender email: onboarding@resend.dev (or the test domain Resend gave you)
   Sender name: EventHive
   ```

**Note**: Emails will show "via resend.dev" but it works perfectly for testing and production!

**Free Tier**: 3,000 emails/month (100/day)

---

## 📊 Quick Comparison

| Provider | Free Tier | Setup Time | Works Without Own Domain? |
|----------|-----------|------------|---------------------------|
| **Brevo** | 300/day | 10 min | ✅ Yes (use verified email) |
| **SendGrid** | 100/day | 10 min | ✅ Yes (use verified email) |
| **Mailgun** | 5K/month (trial) | 15 min | ✅ Yes (use test domain) |
| **Resend** | 3K/month | 5 min | ✅ Yes (use test domain) |

---

## 🎯 My Recommendation

**For your situation, I recommend:**

1. **Brevo** - If you want the highest free tier (300/day)
2. **Resend (test domain)** - If you want the quickest setup (already have account)

Both work perfectly without owning a domain!

---

## 🔧 Detailed Setup: Brevo (Recommended)

### Step 1: Create Account
1. Go to [brevo.com](https://brevo.com)
2. Click **Sign Up Free**
3. Enter your email (use your TUP email)
4. Verify your email

### Step 2: Get SMTP Credentials
1. After login, go to **SMTP & API** in left sidebar
2. Click on **SMTP** tab
3. You'll see:
   - **Server**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **Login**: Your Brevo account email
   - **Password**: Click **Generate** if you don't have one, then copy it

### Step 3: Verify Sender Email
1. Go to **Senders** in left sidebar
2. Click **Add a sender**
3. Enter your email (e.g., your TUP email: `yourname@tup.edu.ph`)
4. Fill in sender details:
   - **Email**: Your email
   - **Name**: EventHive (or your name)
5. Click **Save**
6. Check your email and click the verification link
7. Status will change to "Verified"

### Step 4: Configure in Supabase
1. Go to **Supabase Dashboard** → **Authentication** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Fill in:
   ```
   Host: smtp-relay.brevo.com
   Port: 587
   Username: [Your Brevo account email]
   Password: [Your Brevo SMTP key]
   Sender email: [Your verified sender email, e.g., yourname@tup.edu.ph]
   Sender name: EventHive
   ```
4. Click **Send test email** to verify
5. Click **Save**

### Step 5: Test
1. Try signing up a new user
2. Check email inbox
3. Verification email should arrive!

---

## 🔧 Detailed Setup: Resend Test Domain (Quickest)

### Step 1: Use Existing Resend Account
1. Log in to [resend.com](https://resend.com)
2. Go to **Domains**
3. You'll see a default domain (e.g., `onboarding.resend.dev`)
4. **Don't add a new domain** - just note this domain name

### Step 2: Configure in Supabase
1. Go to **Supabase Dashboard** → **Authentication** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Fill in:
   ```
   Host: smtp.resend.com
   Port: 587
   Username: resend
   Password: [Your Resend API Key]
   Sender email: onboarding@resend.dev (or whatever test domain Resend gave you)
   Sender name: EventHive
   ```
4. Click **Send test email** to verify
5. Click **Save**

**Note**: Emails will show "via resend.dev" in the sender, but they work perfectly!

---

## ✅ Supabase Configuration (Same for All Providers)

Regardless of which provider you choose:

1. **Enable Email Confirmation**:
   - **Authentication** → **Providers** → **Email**
   - Toggle **Confirm email** ON

2. **Set URL Configuration**:
   - **Authentication** → **URL Configuration**
   - **Site URL**: `https://tup-eventhive.vercel.app`
   - **Redirect URLs**: `https://tup-eventhive.vercel.app/**`

---

## 🧪 Testing

After setup:
1. Go to `https://tup-eventhive.vercel.app`
2. Sign up with a TUP email
3. Check email inbox (and spam folder)
4. Click verification link
5. Should auto-login and redirect to homepage

---

## 💡 Why These Work

- **Brevo/SendGrid**: You verify your **email address** (not domain), so you can use any email
- **Mailgun/Resend**: They provide **test domains** you can use without verification
- All of them work perfectly with Supabase SMTP settings

---

## 🆘 Troubleshooting

**"Authentication failed"**:
- Double-check username and password
- For SendGrid: Username must be exactly `apikey`
- For Brevo: Make sure you're using SMTP key, not API key

**"Sender not verified"**:
- Verify your sender email in the provider's dashboard
- Wait a few minutes after verification

**Emails going to spam**:
- Normal for test domains (onboarding@resend.dev, etc.)
- Less likely with verified personal emails
- For production, consider getting your own domain later

---

## 📝 Next Steps

1. Choose a provider (I recommend **Brevo** for best free tier)
2. Follow the setup steps above
3. Configure in Supabase
4. Test the flow
5. You're done! 🎉

No domain ownership required!

