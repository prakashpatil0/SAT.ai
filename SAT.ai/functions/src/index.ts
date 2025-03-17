import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

interface OTPData {
  email: string;
  otp: string;
  type: string;
}

// Configure nodemailer with your email service
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.pass
  }
});

export const sendOTPEmail = functions.https.onCall(async (request: functions.https.CallableRequest<OTPData>) => {
  const { email, otp, type } = request.data;

  if (!email || !otp || !type) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  try {
    // Email template
    const mailOptions = {
      from: `"SAT.ai Support" <${functions.config().email.user}>`,
      to: email,
      subject: 'Password Reset OTP - SAT.ai',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF8447;">SAT.ai Password Reset</h2>
          <p>Hello,</p>
          <p>You have requested to reset your password. Here is your OTP:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
            <strong>${otp}</strong>
          </div>
          <p>This OTP will expire in 5 minutes.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated email. Please do not reply.
          </p>
        </div>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: 'OTP sent successfully'
    };

  } catch (error) {
    console.error('Error sending email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send OTP email');
  }
}); 