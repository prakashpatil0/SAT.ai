import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface OTPRequest {
  phoneNumber: string;
  type: string;
}

interface OTPResponse {
  success: boolean;
  message?: string;
}

export const sendOTP = functions.https.onCall(async (request: functions.https.CallableRequest<OTPRequest>): Promise<OTPResponse> => {
  const { phoneNumber, type } = request.data;

  try {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Firestore
    await admin.firestore().collection('otps').doc(phoneNumber).set({
      otp,
      phoneNumber,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0,
      isUsed: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      type
    });

    // Here you would integrate with your SMS service to send the OTP
    // For example, using Twilio:
    // await twilioClient.messages.create({
    //   body: `Your OTP is: ${otp}`,
    //   to: phoneNumber,
    //   from: process.env.TWILIO_PHONE_NUMBER
    // });

    return { success: true };
  } catch (error) {
    console.error('Error sending OTP:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
    return { 
      success: false, 
      message: errorMessage
    };
  }
});