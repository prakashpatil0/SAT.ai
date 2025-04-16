import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

interface OTPRequest {
  email: string;
  otp: string;
  type: string;
}

interface OTPResponse {
  success: boolean;
  message?: string;
}

export const sendOTPEmail = functions.https.onCall(async (data: OTPRequest) => {
  try {
    const { email, otp, type } = data;

    // Validate email
    if (!email || !email.includes('@')) {
      return {
        success: false,
        message: 'Invalid email address'
      };
    }

    // Prepare email content based on type
    let subject = '';
    let htmlContent = '';

    switch (type) {
      case 'FORGOT_PASSWORD':
        subject = 'Password Reset OTP';
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF8447;">Password Reset OTP</h2>
            <p>Hello,</p>
            <p>You have requested to reset your password. Please use the following OTP to proceed:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #FF8447; font-size: 32px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in 5 minutes.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>Best regards,<br>SAT.ai Team</p>
          </div>
        `;
        break;
      default:
        return {
          success: false,
          message: 'Invalid OTP type'
        };
    }

    // Send email using SendGrid
    const msg = {
      to: email,
      from: 'it@policyplanner.com', // Replace with your verified sender email
      subject: subject,
      html: htmlContent,
    };

    await sgMail.send(msg);

    return {
      success: true,
      message: 'OTP sent successfully'
    };

  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return {
      success: false,
      message: error.message || 'Failed to send OTP'
    };
  }
});

export const sendOTP = functions.https.onCall(async (data, context) => {
  const { email, otp } = data;

  // Create a transporter using your email service
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or your email service
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-app-password'
    }
  });

  // Email content
  const mailOptions = {
    from: 'your-email@gmail.com',
    to: email,
    subject: 'Your OTP for Password Reset',
    html: `
      <h2>Password Reset OTP</h2>
      <p>Your OTP is: <strong>${otp}</strong></p>
      <p>This OTP will expire in 5 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send OTP email');
  }
}); 