import { db } from '@/firebaseConfig';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';

interface ClosingDetail {
  selectedProducts: string[];
  otherProduct?: string;
  amount: number;
  description: string;
}

interface DailyReport {
  numMeetings: number;
  meetingDuration: string;
  positiveLeads: number;
  closingDetails: ClosingDetail[];
  totalClosingAmount: number;
}

// Export as named functions
export const submitDailyReport = async (userId: string, reportData: DailyReport) => {
  try {
    const docRef = await addDoc(collection(db, 'dailyReports'), {
      userId,
      ...reportData,
      date: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error submitting report:', error);
    throw error;
  }
};

export const getUserReports = async (userId: string) => {
  try {
    const q = query(
      collection(db, 'dailyReports'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching reports:', error);
    throw error;
  }
};

const dailyReportService = {
  submitDailyReport,
  getUserReports
};

export default dailyReportService;