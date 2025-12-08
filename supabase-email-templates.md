# EventHive Supabase Email Templates

These are professional HTML email templates for your Supabase Dashboard.
Copy each template to the corresponding section in:
**Supabase Dashboard → Authentication → Email Templates**

---

## 1. Confirmation Email (Email Verification)

**Subject Line:** `Welcome to EventHive - Verify Your Email`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #c62828 0%, #8b0000 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">EventHive</h1>
              <p style="color: #ffd54f; margin: 8px 0 0 0; font-size: 14px;">TUP Campus Events Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">Welcome to EventHive! 🎉</h2>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                Thank you for joining EventHive, the official events platform for TUP! Please verify your email address to complete your registration.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #c62828 0%, #8b0000 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(198, 40, 40, 0.3);">
                      Verify My Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
                If you didn't create an account with EventHive, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eeeeee;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #999999; font-size: 12px; text-align: center;">
                    <p style="margin: 0 0 8px 0;">© 2024 EventHive | Technological University of the Philippines - Manila</p>
                    <p style="margin: 0;">This is an automated message. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Password Reset Email (Recovery)

**Subject Line:** `EventHive - Set Your Password`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #c62828 0%, #8b0000 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">EventHive</h1>
              <p style="color: #ffd54f; margin: 8px 0 0 0; font-size: 14px;">TUP Campus Events Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">Set Your Password 🔐</h2>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
                Click the button below to set up your password for EventHive. This will allow you to log in using your email and password.
              </p>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                <strong>Note:</strong> If you signed up with Google, you can still use "Continue with Google" to log in anytime.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #c62828 0%, #8b0000 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(198, 40, 40, 0.3);">
                      Set My Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Security Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 25px;">
                <tr>
                  <td style="background-color: #fff8e1; border-left: 4px solid #ffd54f; padding: 15px; border-radius: 4px;">
                    <p style="color: #856404; font-size: 14px; margin: 0;">
                      <strong>Security Tip:</strong> This link expires in 24 hours. If you didn't request this, please ignore this email or contact support.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eeeeee;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #999999; font-size: 12px; text-align: center;">
                    <p style="margin: 0 0 8px 0;">© 2024 EventHive | Technological University of the Philippines - Manila</p>
                    <p style="margin: 0;">This is an automated message. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Magic Link Email

**Subject Line:** `EventHive - Your Login Link`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #c62828 0%, #8b0000 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">EventHive</h1>
              <p style="color: #ffd54f; margin: 8px 0 0 0; font-size: 14px;">TUP Campus Events Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">Your Login Link ✨</h2>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                Click the button below to securely log in to EventHive. No password required!
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #c62828 0%, #8b0000 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(198, 40, 40, 0.3);">
                      Log In to EventHive
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
                This link expires in 1 hour and can only be used once. If you didn't request this, please ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eeeeee;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #999999; font-size: 12px; text-align: center;">
                    <p style="margin: 0 0 8px 0;">© 2024 EventHive | Technological University of the Philippines - Manila</p>
                    <p style="margin: 0;">This is an automated message. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 4. Invite Email

**Subject Line:** `You're Invited to EventHive`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #c62828 0%, #8b0000 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">EventHive</h1>
              <p style="color: #ffd54f; margin: 8px 0 0 0; font-size: 14px;">TUP Campus Events Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">You're Invited! 🎊</h2>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                You have been invited to join EventHive, the official events platform for the Technological University of the Philippines. Accept the invitation to discover and participate in campus events!
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #c62828 0%, #8b0000 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(198, 40, 40, 0.3);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 25px 30px; border-top: 1px solid #eeeeee;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #999999; font-size: 12px; text-align: center;">
                    <p style="margin: 0 0 8px 0;">© 2024 EventHive | Technological University of the Philippines - Manila</p>
                    <p style="margin: 0;">This is an automated message. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## How to Apply These Templates

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** → **Email Templates**
3. For each template type (Confirm signup, Reset password, Magic Link, Invite user):
   - Paste the **Subject Line** in the Subject field
   - Paste the **HTML content** (everything between the ```html and ``` markers) in the Body field
4. Click **Save** for each template

The templates use:
- **EventHive red** (`#c62828`, `#8b0000`) - brand primary color
- **EventHive gold** (`#ffd54f`) - accent color
- Professional gradient buttons with shadows
- Mobile-responsive design
- TUP branding in footer
