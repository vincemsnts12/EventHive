# SMTP Provider Setup Guide for EventHive

This guide provides step-by-step instructions for setting up different SMTP providers to handle email verification in EventHive.

## Why You Need a Custom SMTP Provider

Supabase's default SMTP has a **4 emails/hour rate limit**, which is insufficient for production. You need a custom SMTP provider to handle email verification properly.

---

## 🚀 Quick Start: Resend (Recommended)

**Best for**: Quick setup, generous free tier (3,000 emails/month)

### Step 1: Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### Step 2: Get API Key
1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., "EventHive Production")
4. Copy the API key (you'll only see it once!)

### Step 3: Verify Domain (Optional but Recommended)
1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter your domain (e.g., `tup.edu.ph` or a subdomain)
4. Add the DNS records Resend provides to your domain's DNS
5. Wait for verification (usually a few minutes)

**Note**: You can use Resend's test domain for development, but you'll need to verify your own domain for production.

### Step 4: Configure in Supabase
1. Go to Supabase Dashboard > **Authentication** > **SMTP Settings**
2. Enable **Custom SMTP**
3. Fill in:
   - **Host**: `smtp.resend.com`
   - **Port**: `587`
   - **Username**: `resend`
   - **Password**: `[Your Resend API Key]`
   - **Sender email**: `noreply@yourdomain.com` (or your verified email)
   - **Sender name**: `EventHive`
4. Click **Save**

### Step 5: Test
1. Try signing up a new user
2. Check if verification email is received
3. Check Resend dashboard for email logs

---

## 📧 SendGrid Setup

**Best for**: Reliability, well-established service (100 emails/day free)

### Step 1: Create SendGrid Account
1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up for free account
3. Verify your email

### Step 2: Verify Sender
1. Go to **Settings** > **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill in your email details
4. Verify via email link

### Step 3: Create API Key
1. Go to **Settings** > **API Keys**
2. Click **Create API Key**
3. Name it (e.g., "EventHive SMTP")
4. Select **Full Access** or **Restricted Access** (Mail Send permissions)
5. Copy the API key

### Step 4: Configure in Supabase
- **Host**: `smtp.sendgrid.net`
- **Port**: `587`
- **Username**: `apikey` (literally the word "apikey")
- **Password**: `[Your SendGrid API Key]`
- **Sender email**: Your verified sender email
- **Sender name**: `EventHive`

---

## 📬 Brevo (Sendinblue) Setup

**Best for**: Highest free tier (300 emails/day)

### Step 1: Create Brevo Account
1. Go to [brevo.com](https://brevo.com)
2. Sign up for free account
3. Verify your email

### Step 2: Get SMTP Credentials
1. Go to **SMTP & API** > **SMTP**
2. You'll see:
   - **Server**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **Login**: Your Brevo account email
   - **Password**: Your SMTP key (click "Generate" if needed)

### Step 3: Verify Sender
1. Go to **Senders** > **Add a sender**
2. Verify your email address

### Step 4: Configure in Supabase
- **Host**: `smtp-relay.brevo.com`
- **Port**: `587`
- **Username**: Your Brevo account email
- **Password**: Your Brevo SMTP key
- **Sender email**: Your verified sender email
- **Sender name**: `EventHive`

---

## ☁️ Amazon SES Setup

**Best for**: Production scale, very cheap ($0.10 per 1,000 emails)

### Step 1: Create AWS Account
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Create an account (requires credit card, but free tier available)
3. Go to **Amazon SES** service

### Step 2: Verify Email/Domain
1. In SES console, go to **Verified identities**
2. Click **Create identity**
3. Choose **Email address** or **Domain**
4. Follow verification steps

### Step 3: Request Production Access
1. Go to **Account dashboard**
2. Click **Request production access**
3. Fill out the form (explain you're sending verification emails)
4. Wait for approval (usually 24 hours)

### Step 4: Create SMTP Credentials
1. Go to **SMTP settings**
2. Click **Create SMTP credentials**
3. Give it a name (e.g., "EventHive")
4. Download the credentials file (contains username and password)

### Step 5: Configure in Supabase
- **Host**: `email-smtp.[region].amazonaws.com` (e.g., `email-smtp.us-east-1.amazonaws.com`)
- **Port**: `587`
- **Username**: From your downloaded credentials
- **Password**: From your downloaded credentials
- **Sender email**: Your verified email/domain
- **Sender name**: `EventHive`

**Note**: Make sure you're in the correct AWS region (check your SES region in the console).

---

## 🔧 Gmail/Google Workspace Setup

**Best for**: If you already have a Google account

### Step 1: Enable 2-Factor Authentication
1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Enable 2-Step Verification

### Step 2: Generate App Password
1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select **Mail** and **Other (Custom name)**
3. Name it "EventHive SMTP"
4. Copy the 16-character password (no spaces)

### Step 3: Configure in Supabase
- **Host**: `smtp.gmail.com`
- **Port**: `587`
- **Username**: Your full Gmail address
- **Password**: The 16-character app password (not your regular password)
- **Sender email**: Your Gmail address
- **Sender name**: `EventHive`

**Note**: Gmail has a 500 emails/day limit for free accounts, 2,000/day for Google Workspace.

---

## 🧪 Testing Your SMTP Configuration

### Test in Supabase:
1. Go to **Authentication** > **SMTP Settings**
2. Click **Send test email**
3. Enter your email address
4. Check if you receive the test email

### Test in Your App:
1. Sign up a new user
2. Check if verification email is received
3. Check your SMTP provider's dashboard for:
   - Email logs
   - Delivery status
   - Any errors

### Common Issues:

**"Authentication failed"**:
- Double-check username and password
- For SendGrid: Make sure username is exactly `apikey`
- For Gmail: Make sure you're using an App Password, not regular password

**"Connection timeout"**:
- Check if port 587 is correct
- Some networks block SMTP - try from different network
- Check firewall settings

**"Emails not received"**:
- Check spam/junk folder
- Verify sender email is correct
- Check SMTP provider's logs for delivery status
- Make sure domain is verified (if required)

---

## 📊 Provider Comparison

| Provider | Free Tier | Setup Time | Best For |
|----------|-----------|------------|----------|
| **Resend** | 3,000/month | 5 min | Quick setup, modern |
| **SendGrid** | 100/day | 10 min | Reliability |
| **Brevo** | 300/day | 10 min | Highest free tier |
| **Mailgun** | 5K/month (trial) | 15 min | High volume |
| **Amazon SES** | Pay-as-you-go | 30 min | Production scale |
| **Gmail** | 500/day | 5 min | Personal projects |

---

## 💡 Recommendations

### For Development/Testing:
- **Resend** or **Brevo** (easiest setup, good free tiers)

### For Production (Small Scale):
- **Brevo** (300/day free) or **SendGrid** (100/day free)

### For Production (Medium Scale):
- **Resend** (3,000/month) or **Amazon SES** (very cheap)

### For Production (Large Scale):
- **Amazon SES** (scales well, very cheap)

---

## 🔒 Security Best Practices

1. **Never commit SMTP credentials to git**
   - Use environment variables
   - Supabase stores them securely in dashboard

2. **Use API keys, not passwords**
   - Most providers offer API keys
   - Easier to rotate if compromised

3. **Verify your domain**
   - Improves email deliverability
   - Prevents emails from going to spam

4. **Monitor email logs**
   - Check for failed deliveries
   - Watch for unusual activity

---

## 📝 Next Steps

After setting up SMTP:
1. Test email verification flow
2. Monitor email delivery rates
3. Set up email templates in Supabase (optional)
4. Consider setting up SPF/DKIM records for better deliverability

---

## 🆘 Need Help?

- **Resend**: [docs.resend.com](https://docs.resend.com)
- **SendGrid**: [docs.sendgrid.com](https://docs.sendgrid.com)
- **Brevo**: [help.brevo.com](https://help.brevo.com)
- **Amazon SES**: [docs.aws.amazon.com/ses](https://docs.aws.amazon.com/ses)

