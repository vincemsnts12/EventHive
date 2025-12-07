# Supabase Email Verification Setup Guide

This guide explains how to enable email verification for EventHive signups.

## Prerequisites

- Access to your Supabase project dashboard
- EventHive codebase with email verification implementation

## Step 1: Enable Email Confirmation in Supabase

1. Log in to your [Supabase Dashboard](https://app.supabase.com)
2. Select your EventHive project
3. Navigate to **Authentication** > **Providers**
4. Click on the **Email** provider
5. Enable the **Confirm email** toggle
   - This requires users to verify their email before they can sign in
   - Unverified users will not be able to log in

## Step 2: Configure Site URL

1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**
2. Set the **Site URL** to your application's base URL:
   - For local development: `http://localhost:3000` (or your local port)
   - For production: `https://your-domain.com`
3. Add **Redirect URLs**:
   - `http://localhost:3000/**` (for local development)
   - `https://your-domain.com/**` (for production)
   - These URLs allow Supabase to redirect users back to your app after email verification

## Step 3: Customize Email Templates (Optional)

1. Navigate to **Authentication** > **Email Templates**
2. Customize the **Confirm signup** template:
   - You can modify the subject line and email body
   - The verification link is automatically included
   - Make sure the link points to your site URL

## Step 4: Configure SMTP (Recommended for Production)

For production, configure a custom SMTP server:

1. Go to **Authentication** > **SMTP Settings**
2. Enable **Custom SMTP**
3. Configure your SMTP provider (Gmail, SendGrid, etc.):
   - **Host**: Your SMTP server hostname
   - **Port**: SMTP port (usually 587 for TLS)
   - **Username**: Your SMTP username
   - **Password**: Your SMTP password
   - **Sender email**: The email address that will send verification emails
   - **Sender name**: Display name for verification emails

## Step 5: Test Email Verification

1. **Sign up a new user:**
   - Go to your EventHive application
   - Click "Sign Up"
   - Enter a TUP email address and create an account
   - You should NOT see a success message (as per requirements)

2. **Check email:**
   - The user should receive a verification email
   - The email contains a verification link

3. **Verify email:**
   - Click the verification link in the email
   - User should be automatically logged in
   - User should be redirected to the homepage
   - Welcome message should appear for first-time signups

4. **Test unverified login:**
   - Try to log in before verifying email
   - Should see error: "Please verify before logging in. A verification has been sent to your TUP Email."
   - Login should fail

## How It Works

### Signup Flow:
1. User signs up with email/password
2. Supabase sends verification email automatically
3. User cannot log in until email is verified
4. No success message shown (user must verify first)

### Email Verification Flow:
1. User clicks verification link in email
2. Supabase processes the verification token
3. User is automatically logged in
4. User is redirected to homepage
5. Welcome message appears for first-time signups

### Login Flow:
1. User attempts to log in
2. System checks if email is verified (`email_confirmed_at` field)
3. If unverified:
   - Login fails
   - Error message: "Please verify before logging in. A verification has been sent to your TUP Email."
4. If verified:
   - Login succeeds
   - "Log in successful!" message appears (for subsequent logins)

### Google OAuth Flow:
- Google OAuth emails are typically already verified by Google
- OAuth users are automatically verified
- First-time OAuth signups still show welcome message

## Troubleshooting

### Verification emails not being sent:
- Check **SMTP Settings** in Supabase dashboard
- Verify **Site URL** is correctly configured
- Check spam/junk folder
- For development, check Supabase logs for email sending errors

### Verification link not working:
- Ensure **Redirect URLs** include your site URL with wildcard (`/**`)
- Check that the link in the email points to your site URL
- Verify the token hasn't expired (tokens expire after a set time)

### Users can log in without verification:
- Verify **Confirm email** is enabled in Authentication > Providers > Email
- Check that `email_confirmed_at` is being checked in login handler
- Ensure auth state listener is checking verification status

## Code Implementation

The email verification is implemented in:
- `js/eventhive-pop-up__log&sign.js`: Signup and login handlers
- `js/eventhive-supabase.template.js`: Email verification callback handler and auth state listener

Key functions:
- `handleEmailVerificationCallback()`: Processes email verification tokens
- Login handler checks `email_confirmed_at` before allowing login
- Auth state listener checks verification status on SIGNED_IN events

## Notes

- Email verification is required for **all** first-time signups (email/password and OAuth)
- Unverified users can browse the site as guests
- Unverified users cannot log in until they verify their email
- Verification links expire after a set time (configured in Supabase)
- Users can request a new verification email if needed (future feature)

