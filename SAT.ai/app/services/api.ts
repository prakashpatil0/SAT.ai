import axios from 'axios';
import { collection, addDoc, serverTimestamp, getDocs, getDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

const API_URL = 'http://192.https://sat1-f51fd-default-rtdb.firebaseio.com/.0.110:5000';  // your IP

let lastConnectionLog = 0;

export const testDatabaseConnection = async () => {
  try {
    // First try to test Firebase connection
    const testDoc = await getDocs(collection(db, 'users'));
    
    return true;
  } catch (error) {
    return false;
  }
};

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

interface UserProfileData {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
}

const api = {
  getUserProfile: async (userId: string): Promise<UserProfileData> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as UserProfileData;
      }
      throw new Error('User not found');
    } catch (error) {
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
      throw error;
    }
  },

  markAttendance: async (userId: string, data: any) => {
    try {
      const docRef = await addDoc(collection(db, 'attendance'), {
        userId,
        ...data,
        createdAt: serverTimestamp()
      });
      return { id: docRef.id };
    } catch (error) {
      throw error;
    }
  },

  saveCallDetails: async (userId: string, data: any) => {
    try {
      const docRef = await addDoc(collection(db, 'calls'), {
        userId,
        ...data,
        createdAt: serverTimestamp()
      });
      return { id: docRef.id };
    } catch (error) {
      throw error;
    }
  },

  createContact: async (contactData: any) => {
    try {
      const docRef = await addDoc(collection(db, 'contacts'), {
        ...contactData,
        createdAt: serverTimestamp()
      });
      return { id: docRef.id };
    } catch (error) {
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
      throw error;
    }
  },

  deleteContact: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'contacts', id));
      return { success: true };
    } catch (error) {
      throw error;
    }
  },

  login: async (credentials: { email: string; password: string }) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  testConnection: async () => {
    try {
      const response = await axios.get(`${API_URL}/test-db`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  saveDailyReport: async (userId: string, reportData: DailyReportData) => {
    try {
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

      const docRef = await addDoc(collection(db, 'dailyReports'), formattedData);
      
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
        // Continue even if notification fails
      }

      return { success: true, reportId: docRef.id };
    } catch (error) {
      throw error;
    }
  },
};

export default api;