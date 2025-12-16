import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, code } = req.body;

        // Validate inputs
        if (!email || !code) {
            return res.status(400).json({ error: 'Missing required fields: email and code' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate code format (6 digits)
        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({ error: 'Invalid code format' });
        }

        // Check environment variables
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error('Missing SMTP configuration');
            return res.status(500).json({ error: 'Email service not configured' });
        }

        // Create transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Load HTML template
        let html;
        try {
            const templatePath = path.join(process.cwd(), 'email-templates', 'device-verification.html');
            html = fs.readFileSync(templatePath, 'utf8');
            html = html.replace('{{CODE}}', code);
        } catch (templateError) {
            // Fallback to inline template if file not found
            console.warn('Template file not found, using fallback');
            html = `
        <!DOCTYPE html>
        <html>
        <head><title>EventHive - Verification Code</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 30px;">
            <h1 style="color: #B81E20; text-align: center;">🐝 EventHive</h1>
            <h2 style="color: #333;">Device Verification</h2>
            <p>We noticed a login from a new device. Please enter this code to verify:</p>
            <div style="background: #f5f5f5; border: 2px dashed #B81E20; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 36px; font-weight: bold; color: #B81E20; letter-spacing: 8px; font-family: monospace;">${code}</span>
            </div>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p style="color: #666; font-size: 12px;">If you didn't try to log in, please ignore this email.</p>
          </div>
        </body>
        </html>
      `;
        }

        // Send email
        const mailOptions = {
            from: process.env.SMTP_FROM || `"EventHive" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'EventHive - Device Verification Code',
            html: html
        };

        await transporter.sendMail(mailOptions);

        console.log(`MFA code sent to ${email}`);
        return res.status(200).json({ success: true, message: 'Verification code sent' });

    } catch (error) {
        console.error('Error sending MFA email:', error);
        return res.status(500).json({ error: 'Failed to send verification email' });
    }
}
