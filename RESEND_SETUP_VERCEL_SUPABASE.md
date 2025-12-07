# Resend Setup for EventHive (Vercel + Supabase)

This guide walks you through setting up Resend for email verification in your EventHive project deployed on Vercel (frontend) and Supabase (backend).

## Overview

- **Frontend**: Deployed on Vercel
- **Backend/Database**: Supabase
- **Email Service**: Resend (configured in Supabase)
- **Purpose**: Send email verification links to users

---

## Step 1: Create Resend Account

1. Go to [resend.com](https://resend.com)
2. Click **Sign Up** (or **Get Started**)
3. Sign up with your email (use your TUP email or personal email)
4. Verify your email address via the confirmation email

---

## Step 2: Get Your API Key

1. After logging in, you'll be in the Resend Dashboard
2. Click on **API Keys** in the left sidebar
3. Click **Create API Key** button
4. Fill in:
   - **Name**: `EventHive Production` (or any name you prefer)
   - **Permission**: Select **Sending access** (full access is fine too)
5. Click **Add API Key**
6. **IMPORTANT**: Copy the API key immediately - you'll only see it once!
   - It looks like: `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Save it somewhere secure (password manager, notes, etc.)

---

## Step 3: Verify Your Domain (IMPORTANT)

### ⚠️ Important Note About Vercel Domains

**You CANNOT use `tup-eventhive.vercel.app` as a domain in Resend** because:
- Vercel subdomains are "free public domains"
- Resend requires domain ownership
- You don't own the `vercel.app` domain

### Option A: Use Resend's Test Domain (Recommended - No Domain Needed!)

**This is the easiest option and works perfectly:**

1. In Resend Dashboard, go to **Domains**
2. You'll see a default test domain like `onboarding.resend.dev`
3. **Use this domain** - no verification needed!
4. Emails will show "via resend.dev" but work perfectly

**This is fine for production** - many apps use provider test domains.

### Option B: Verify Your Own Domain (If You Have One)

**Only if you own a domain** (e.g., `eventhive.tup.edu.ph` or a custom domain like `eventhive.com`):

1. In Resend Dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `tup.edu.ph` or `eventhive.com`)
4. Click **Add Domain**
5. Resend will show you DNS records to add:
   - **SPF Record** (TXT record)
   - **DKIM Record** (CNAME records)
   - **DMARC Record** (optional, but recommended)

6. Add these DNS records to your domain's DNS settings:
   - If using TUP domain: Contact your IT department to add the records
   - If using custom domain: Add them in your domain registrar (GoDaddy, Namecheap, etc.)

7. Wait for verification (usually 5-30 minutes)
8. Check status in Resend dashboard - it will show "Verified" when ready

**DNS Records Example** (your actual values will be different):
```
Type: TXT
Name: @
Value: v=spf1 include:resend.com ~all

Type: CNAME
Name: resend._domainkey
Value: [resend-provided-value]
```

---

## Step 4: Configure Resend in Supabase

1. **Go to Supabase Dashboard**
   - Log in at [app.supabase.com](https://app.supabase.com)
   - Select your EventHive project

2. **Navigate to SMTP Settings**
   - Go to **Authentication** in the left sidebar
   - Click on **SMTP Settings** (or **Providers** > **Email** > **SMTP Settings**)

3. **Enable Custom SMTP**
   - Toggle **Enable Custom SMTP** to ON

4. **Fill in Resend Credentials**:
   ```
   Host: smtp.resend.com
   Port: 587
   Username: resend
   Password: [Paste your Resend API Key here]
   Sender email: noreply@yourdomain.com
   Sender name: EventHive
   ```

   **Important Notes**:
   - **Host**: Must be exactly `smtp.resend.com`
   - **Port**: `587` (TLS)
   - **Username**: Just the word `resend` (not your email)
   - **Password**: Your Resend API Key (the one you copied in Step 2)
   - **Sender email**: 
     - **Recommended**: `onboarding@resend.dev` (or the test domain Resend shows you)
     - If you verified your own domain: `noreply@yourdomain.com` (e.g., `noreply@tup.edu.ph`)
     - **Note**: You cannot use `tup-eventhive.vercel.app` - use Resend's test domain instead
   - **Sender name**: `EventHive` (or any name you want users to see)

5. **Test the Connection**
   - Click **Send test email** button
   - Enter your email address
   - Check your inbox (and spam folder)
   - If you receive the test email, configuration is correct!

6. **Save Settings**
   - Click **Save** or the checkmark icon
   - Supabase will validate the connection

---

## Step 5: Enable Email Confirmation in Supabase

1. In Supabase Dashboard, go to **Authentication** > **Providers**
2. Click on **Email** provider
3. Enable **Confirm email** toggle
   - This requires users to verify their email before logging in
4. **Save** the settings

---

## Step 6: Configure Redirect URLs

1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**
2. Set **Site URL** to your Vercel deployment URL:
   - `https://tup-eventhive.vercel.app`
   - Or your custom domain if you have one: `https://eventhive.tup.edu.ph`

3. Add **Redirect URLs**:
   - `https://tup-eventhive.vercel.app/**` (your Vercel URL with `/**`)
   - `https://your-custom-domain.com/**` (if you have a custom domain)
   - `http://localhost:3000/**` (for local development)

   **Note**: The `/**` wildcard allows Supabase to redirect to any page after email verification.

---

## Step 7: Test Email Verification Flow

### Test Signup:
1. Go to your deployed EventHive app: `https://tup-eventhive.vercel.app`
2. Click **Sign Up**
3. Enter a TUP email address and create an account
4. **Expected**: No success message (user must verify first)

### Test Email Delivery:
1. Check the email inbox you used for signup
2. Look for verification email from Resend/EventHive
3. Check spam/junk folder if not in inbox
4. **Expected**: Email should arrive within seconds

### Test Verification:
1. Click the verification link in the email
2. **Expected**: 
   - User is automatically logged in
   - Redirected to homepage
   - Welcome message appears (for first-time signup)

### Test Unverified Login:
1. Try to log in before verifying email
2. **Expected**: Error message: "Please verify before logging in. A verification has been sent to your TUP Email."

---

## Step 8: Monitor Email Delivery

### In Resend Dashboard:
1. Go to **Emails** in Resend dashboard
2. You'll see:
   - All emails sent
   - Delivery status (delivered, bounced, etc.)
   - Open rates (if enabled)
   - Click rates

### In Supabase Dashboard:
1. Go to **Authentication** > **Users**
2. Check user status:
   - Unverified users will show "Unconfirmed"
   - Verified users will show "Confirmed"

---

## Troubleshooting

### Emails Not Being Sent

**Check Resend Dashboard**:
- Go to **Emails** tab
- Look for failed emails
- Check error messages

**Common Issues**:
- ❌ **"Authentication failed"**: 
  - Double-check API key is correct
  - Make sure username is exactly `resend` (not your email)
  
- ❌ **"Connection timeout"**:
  - Verify host is `smtp.resend.com`
  - Check port is `587`
  - Try from different network (some block SMTP)

- ❌ **"Sender email not verified"**:
  - Verify your domain in Resend
  - Or use Resend's test domain for testing

### Emails Going to Spam

**Solutions**:
1. **Verify your domain** (adds SPF/DKIM records)
2. **Use a proper sender email** (not a test domain)
3. **Set up DMARC** (optional, but helps)
4. **Warm up your domain** (send emails gradually at first)

### Verification Link Not Working

**Check**:
1. **Redirect URLs** in Supabase include `https://tup-eventhive.vercel.app/**`
2. **Site URL** is set to `https://tup-eventhive.vercel.app`
3. Link hasn't expired (usually valid for 24 hours)
4. Check browser console for errors

### Rate Limits

**Resend Free Tier**:
- 3,000 emails/month
- 100 emails/day
- If you hit the limit, upgrade to paid plan or wait for reset

---

## Production Checklist

Before going live:

- [ ] Resend account created
- [ ] API key generated and saved securely
- [ ] Domain verified in Resend (or using test domain)
- [ ] SMTP configured in Supabase
- [ ] Test email sent successfully
- [ ] Email confirmation enabled in Supabase
- [ ] Site URL set to production Vercel URL
- [ ] Redirect URLs configured
- [ ] Tested signup flow
- [ ] Tested email verification
- [ ] Tested unverified login blocking
- [ ] Monitored email delivery in Resend dashboard

---

## Security Best Practices

1. **Never commit API keys to git**
   - Resend API key is stored securely in Supabase dashboard
   - No need to add to Vercel environment variables

2. **Rotate API keys periodically**
   - Create new API key in Resend
   - Update in Supabase
   - Delete old key

3. **Use domain verification**
   - Improves email deliverability
   - Prevents emails from going to spam
   - More professional appearance

4. **Monitor email logs**
   - Check Resend dashboard regularly
   - Watch for bounces or failures
   - Set up alerts if available

---

## Cost Information

**Resend Free Tier**:
- ✅ 3,000 emails/month
- ✅ 100 emails/day
- ✅ Unlimited domains
- ✅ Email logs and analytics

**If you need more**:
- Pro plan: $20/month for 50,000 emails
- Pay-as-you-go: $0.30 per 1,000 emails

For EventHive, the free tier should be sufficient unless you have very high signup volume.

---

## Next Steps

After setup:
1. ✅ Test the complete flow
2. ✅ Monitor email delivery
3. ✅ Customize email templates in Supabase (optional)
4. ✅ Set up email analytics (optional)

---

## Need Help?

- **Resend Docs**: [resend.com/docs](https://resend.com/docs)
- **Resend Support**: support@resend.com
- **Supabase Docs**: [supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)

---

## Quick Reference

**Resend SMTP Settings for Supabase** (Using Test Domain):
```
Host: smtp.resend.com
Port: 587
Username: resend
Password: [Your Resend API Key]
Sender: onboarding@resend.dev (or your Resend test domain)
```

**Alternative Providers** (If you want more free emails):
- See `SMTP_PROVIDERS_NO_DOMAIN_NEEDED.md` for Brevo, SendGrid, Mailgun
- Brevo offers 300 emails/day free (vs Resend's 100/day)

**Supabase Settings**:
- Authentication > Providers > Email > Confirm email: **ON**
- Authentication > URL Configuration > Site URL: **https://tup-eventhive.vercel.app**
- Authentication > URL Configuration > Redirect URLs: **https://tup-eventhive.vercel.app/**
- Authentication > SMTP Settings > Custom SMTP: **ON**

