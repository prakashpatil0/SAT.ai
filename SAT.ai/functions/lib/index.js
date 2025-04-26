"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLeaveEmail = exports.sendOTP = exports.sendOTPEmail = void 0;

// Firebase Cloud Functions using SendGrid and Nodemailer
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const nodemailer = require("nodemailer");
admin.initializeApp();
// ✅ Initialize SendGrid with your API key
sgMail.setApiKey("YOUR_SENDGRID_API_KEY");
// ✅ Send OTP via SendGrid
exports.sendOTPEmail = functions.https.onCall(async (request) => {
    try {
        const { email, otp, type } = request.data;
        if (!email || !email.includes('@')) {
            return { success: false, message: 'Invalid email address' };
        }
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
                return { success: false, message: 'Invalid OTP type' };
        }
        const msg = {
            to: email,
            from: 'it@policyplanner.com',
            subject,
            html: htmlContent,
        };
        await sgMail.send(msg);
        return { success: true, message: 'OTP sent successfully' };
    }
    catch (error) {
        console.error('Error sending OTP:', error);
        return { success: false, message: error.message || 'Failed to send OTP' };
    }
});
// ✅ Send OTP via Nodemailer
exports.sendOTP = functions.https.onCall(async (data, context) => {
    const { email, otp } = data;
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'your-email@gmail.com',
            pass: 'your-app-password'
        }
    });
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
    }
    catch (error) {
        console.error('Error sending email:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send OTP email');
    }
});
exports.sendLeaveEmail = functions.https.onRequest(async (req, res) => {
    try {
        const { to, subject, html } = req.body;
        if (!to || !subject || !html) {
            res.status(400).send("Missing required fields (to, subject, html)");
            return;
        }
        const msg = {
            to,
            from: "it@policyplanner.com",
            subject,
            html,
        };
        await sgMail.send(msg);
        res.status(200).send("Leave email sent successfully");
    }
    catch (error) {
        console.error("Error sending leave email:", error);
        res.status(500).send("Failed to send leave email");
    }
});
//# sourceMappingURL=index.js.map