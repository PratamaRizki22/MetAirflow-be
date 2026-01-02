const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

/**
 * Email Service using Nodemailer
 * Handles sending emails for password reset and other notifications
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter with SMTP configuration
   */
  initializeTransporter() {
    console.log('🔧 Initializing SMTP transporter...');
    console.log('📧 SMTP Configuration:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      user: process.env.SMTP_USER ? '***configured***' : '❌ MISSING',
      pass: process.env.SMTP_PASS ? '***configured***' : '❌ MISSING',
    });

    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    this.transporter = nodemailer.createTransport(smtpConfig);

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email service initialization failed:', error.message);
        console.error('❌ Full error:', error);
      } else {
        console.log('✅ Email service is ready to send messages');
      }
    });
  }

  /**
   * Send password reset email
   * @param {string} to - Recipient email address
   * @param {string} resetToken - Password reset token
   * @param {string} userName - User's name
   */
  async sendPasswordResetEmail(to, resetToken, userName = 'User') {
    try {
      console.log('📨 Starting password reset email process...');
      console.log('📬 Recipient:', to);
      console.log('👤 User name:', userName);
      console.log('🔗 FRONTEND_MOBILE_URL:', process.env.FRONTEND_MOBILE_URL);

      const resetUrl = `${process.env.FRONTEND_MOBILE_URL}/reset-password?token=${resetToken}`;
      const expiresIn = '30 minutes';

      console.log('🔗 Generated reset URL:', resetUrl);

      // Render email template
      const templatePath = path.join(
        __dirname,
        '..',
        '..',
        'templates',
        'reset-password.ejs'
      );

      console.log('📄 Rendering email template...');

      const htmlContent = await ejs.renderFile(templatePath, {
        userName,
        resetUrl,
        resetToken,
        expiresIn,
        supportEmail: process.env.SMTP_USER,
      });

      console.log('✅ Template rendered successfully');

      // Email options
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to,
        subject: 'Reset Your Rentverse Password',
        html: htmlContent,
        text: `Hi ${userName},\n\nYou requested to reset your password.\n\nPlease use this link to reset your password: ${resetUrl}\n\nThis link will expire in ${expiresIn}.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nRentverse Team`,
      };

      console.log('📧 Sending email from:', mailOptions.from);
      console.log('📧 Sending email to:', mailOptions.to);

      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent successfully!');
      console.log('📨 Message ID:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send password reset email');
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Full error:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send a test email (for testing SMTP configuration)
   * @param {string} to - Recipient email address
   */
  async sendTestEmail(to) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to,
        subject: 'Rentverse - SMTP Test Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10A0F7;">SMTP Configuration Test</h2>
            <p>This is a test email from your Rentverse backend.</p>
            <p>If you're receiving this, your SMTP configuration is working correctly! ✅</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Sent from Rentverse Backend | ${new Date().toLocaleString()}
            </p>
          </div>
        `,
        text: 'This is a test email from Rentverse. If you received this, your SMTP is working!',
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Test email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send test email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
