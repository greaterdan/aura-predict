// Vercel serverless function for /api/waitlist
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const notificationEmail = 'dev@probly.tech';
    const subject = `New Waitlist Signup: ${email}`;
    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Agent Builder Waitlist Signup</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated notification from the Probly waitlist system.</p>
      </div>
    `;
    const textMessage = `
New user joined the Agent Builder waitlist:

Email: ${email}
Timestamp: ${new Date().toISOString()}
    `.trim();

    console.log(`\n=== WAITLIST SIGNUP ===`);
    console.log(`Email: ${email}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`========================\n`);

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
        },
      });

      if (process.env.SMTP_USER || process.env.EMAIL_USER) {
        const mailOptions = {
          from: process.env.SMTP_USER || process.env.EMAIL_USER,
          to: notificationEmail,
          subject: subject,
          text: textMessage,
          html: htmlMessage,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email notification sent to ${notificationEmail}`);
      } else {
        console.log(`⚠️  Email credentials not configured. Email would be sent to: ${notificationEmail}`);
        console.log(`   Configure SMTP_USER and SMTP_PASS environment variables to enable email sending.`);
      }
    } catch (emailError) {
      console.error('Error sending notification email:', emailError);
      console.error('Email error details:', emailError.message);
    }

    return res.json({ 
      success: true, 
      message: 'Successfully joined waitlist',
      email: email 
    });
  } catch (error) {
    console.error('Waitlist endpoint error:', error);
    return res.status(500).json({ 
      error: 'Failed to process waitlist signup',
      message: error.message 
    });
  }
}

