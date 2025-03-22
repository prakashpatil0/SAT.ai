import axios from 'axios';
import { collection, addDoc, serverTimestamp, getDocs, getDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

const API_URL = 'http://192.https://sat1-f51fd-default-rtdb.firebaseio.com/.0.110:5000';  // your IP

let lastConnectionLog = 0;

export const testDatabaseConnection = async () => {
  try {
    // First try to test Firebase connection
    const testDoc = await getDocs(collection(db, 'users'));
    
    const now = Date.now();
    // Only log if more than 5 minutes have passed
    if (now - lastConnectionLog > 300000) {
      console.log('✅ Firebase Database connected successfully');
      lastConnectionLog = now;
    }
    
    // Then try to test backend server if needed
    try {
      const response = await fetch(`${API_URL}/test-db`);
      const data = await response.json();
      
      if (data.connected) {
        return true;
      }
    } catch (serverError) {
      // Silent fail for backend
      return true; // Still return true if Firebase is working
    }

    return true;
  } catch (error) {
    console.error('❌ Error testing database connection:', error);
    return false;
  }
};

// Move interfaces outside the api object
interface ClosingDetail {
  products: string[];
  otherProduct?: string;
  amount: number;
  description: string;
}

interface DailyReportData {
  userId: string;
  date: Date;
  numMeetings: number;
  meetingDuration: string;
  positiveLeads: number;
  closingDetails: ClosingDetail[];
  totalClosingAmount: number;
  status?: string;
  comments?: string;
  durationInHours?: number;
  positiveLeadsPercentage?: number;
  numCallsPercentage?: number;
  durationPercentage?: number;
  closingPercentage?: number;
  percentageAchieved?: number;
}

// Add this interface at the top with your other interfaces
interface UserProfileData {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  // Add other fields as needed
}

const api = {
  // User APIs
  getUserProfile: async (userId: string): Promise<UserProfileData> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as UserProfileData;
      }
      throw new Error('User not found');
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  },

  updateUserProfile: async (userId: string, data: any) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  },

  // Attendance APIs
  markAttendance: async (userId: string, data: any) => {
    try {
      const docRef = await addDoc(collection(db, 'attendance'), {
        userId,
        ...data,
        createdAt: serverTimestamp()
      });
      return { id: docRef.id };
    } catch (error) {
      console.error('Error marking attendance:', error);
      throw error;
    }
  },

  // Call APIs
  saveCallDetails: async (userId: string, data: any) => {
    try {
      const docRef = await addDoc(collection(db, 'calls'), {
        userId,
        ...data,
        createdAt: serverTimestamp()
      });
      return { id: docRef.id };
    } catch (error) {
      console.error('Error saving call details:', error);
      throw error;
    }
  },

  // Contacts APIs
  createContact: async (contactData: any) => {
    try {
      const docRef = await addDoc(collection(db, 'contacts'), {
        ...contactData,
        createdAt: serverTimestamp()
      });
      return { id: docRef.id };
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  },

  getContacts: async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'contacts'));
      const contacts: any[] = [];
      querySnapshot.forEach((doc) => {
        contacts.push({ id: doc.id, ...doc.data() });
      });
      return contacts;
    } catch (error) {
      console.error('Error fetching contacts:', error);
      throw error;
    }
  },

  getContactById: async (id: string) => {
    try {
      const docRef = await getDoc(doc(db, 'contacts', id));
      if (docRef.exists()) {
        return { id: docRef.id, ...docRef.data() };
      }
      throw new Error('Contact not found');
    } catch (error) {
      console.error('Error fetching contact:', error);
      throw error;
    }
  },

  updateContact: async (id: string, contactData: any) => {
    try {
      await updateDoc(doc(db, 'contacts', id), {
        ...contactData,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  },

  deleteContact: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'contacts', id));
      return { success: true };
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  },

  // Login
  login: async (credentials: { email: string; password: string }) => {
    try {
      console.log('Attempting login with:', credentials); // Debug log
      
      // Test server connection first
      try {
        const testResponse = await fetch('http://10.0.2.2:3000/test');
        console.log('Server test response:', await testResponse.json());
      } catch (error) {
        console.error('Server connection test failed:', error);
      }

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      console.log('Response status:', response.status); // Debug log
      const data = await response.json();
      console.log('Login response data:', data); // Debug log
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Add this test function
  testConnection: async () => {
    try {
      const response = await axios.get(`${API_URL}/test-db`);
      console.log('Database connection test:', response.data);
      return response.data;
    } catch (error) {
      console.error('Connection test failed:', error);
      throw error;
    }
  },

  saveDailyReport: async (userId: string, reportData: DailyReportData) => {
    try {
      // Add debug logs
      console.log('Attempting to save report for user:', userId);
      console.log('Report data:', reportData);

      // Validate user exists
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const formattedData = {
        userId,
        date: reportData.date || new Date(),
        numMeetings: Number(reportData.numMeetings),
        meetingDuration: reportData.meetingDuration,
        positiveLeads: Number(reportData.positiveLeads),
        closingDetails: reportData.closingDetails.map(detail => ({
          products: detail.products,
          otherProduct: detail.otherProduct || '',
          amount: Number(detail.amount),
          description: detail.description
        })),
        totalClosingAmount: Number(reportData.totalClosingAmount),
        status: 'submitted',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        durationInHours: reportData.durationInHours,
        positiveLeadsPercentage: reportData.positiveLeadsPercentage,
        numCallsPercentage: reportData.numCallsPercentage,
        durationPercentage: reportData.durationPercentage,
        closingPercentage: reportData.closingPercentage,
        percentageAchieved: reportData.percentageAchieved
      };

      // Try saving to dailyReports collection
      try {
        const docRef = await addDoc(collection(db, 'dailyReports'), formattedData);
        console.log('Report saved successfully with ID:', docRef.id);
        
        // Try creating notification
        try {
          await addDoc(collection(db, 'notifications'), {
            type: 'daily_report',
            userId,
            reportId: docRef.id,
            status: 'unread',
            message: `New daily report submitted by ${userId}`,
            createdAt: serverTimestamp()
          });
        } catch (notifError) {
          console.error('Notification creation failed:', notifError);
          // Continue even if notification fails
        }

        return { success: true, reportId: docRef.id };
      } catch (saveError) {
        console.error('Detailed save error:', saveError);
        throw saveError;
      }

    } catch (error) {
      console.error('Error saving daily report:', error);
      throw error;
    }
  },
};

export default api; 