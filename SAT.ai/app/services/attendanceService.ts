import { auth, db, storage } from "@/firebaseConfig";
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export interface AttendanceRecord {
  punchIn: {
    time: Date;
    photoUrl: string;
    location: {
      latitude: number;
      longitude: number;
    };
  };
  punchOut?: {
    time: Date;
    photoUrl: string;
    location: {
      latitude: number;
      longitude: number;
    };
  };
  status: 'present' | 'half_day' | 'absent' | 'on_leave';
  totalHours?: number;
}

export const uploadAttendancePhoto = async (uri: string, userId: string, type: 'punchIn' | 'punchOut') => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const response = await fetch(uri);
    const blob = await response.blob();
    const timestamp = new Date().getTime();
    
    // Create a unique filename with user ID and timestamp
    const filename = `${userId}_${type}_${timestamp}.jpg`;
    const storageRef = ref(storage, `attendance/${userId}/${filename}`);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, blob);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading attendance photo:', error);
    if (error.code === 'storage/unauthorized') {
      throw new Error('You do not have permission to upload photos. Please contact support.');
    }
    throw new Error('Failed to upload attendance photo. Please try again.');
  }
};

export const saveAttendanceRecord = async (
  userId: string,
  type: 'punchIn' | 'punchOut',
  photoUrl: string,
  location: { latitude: number; longitude: number }
) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const time = now;

    const attendanceRef = doc(db, 'attendance', userId, year.toString(), month.toString(), date.toString());
    const attendanceDoc = await getDoc(attendanceRef);

    if (type === 'punchIn') {
      await setDoc(attendanceRef, {
        punchIn: {
          time: Timestamp.fromDate(time),
          photoUrl,
          location
        },
        status: 'present'
      }, { merge: true });
    } else {
      const existingData = attendanceDoc.data() as AttendanceRecord;
      const punchInTime = existingData.punchIn.time.toDate();
      const totalHours = (time.getTime() - punchInTime.getTime()) / (1000 * 60 * 60);

      await setDoc(attendanceRef, {
        punchOut: {
          time: Timestamp.fromDate(time),
          photoUrl,
          location
        },
        totalHours,
        status: totalHours >= 4 ? 'present' : 'half_day'
      }, { merge: true });
    }

    return true;
  } catch (error) {
    console.error('Error saving attendance record:', error);
    throw error;
  }
};

export const getMonthlyAttendance = async (userId: string, year: number, month: number) => {
  try {
    const attendanceRef = collection(db, 'attendance', userId, year.toString(), month.toString());
    const attendanceSnapshot = await getDocs(attendanceRef);
    
    const attendanceData: { [date: string]: AttendanceRecord } = {};
    attendanceSnapshot.forEach(doc => {
      attendanceData[doc.id] = doc.data() as AttendanceRecord;
    });

    return attendanceData;
  } catch (error) {
    console.error('Error fetching monthly attendance:', error);
    throw error;
  }
};

export const getAttendanceStats = async (userId: string, year: number, month: number) => {
  try {
    const attendanceData = await getMonthlyAttendance(userId, year, month);
    
    const stats = {
      present: 0,
      halfDay: 0,
      absent: 0,
      onLeave: 0,
      totalDays: Object.keys(attendanceData).length
    };

    Object.values(attendanceData).forEach(record => {
      stats[record.status]++;
    });

    return stats;
  } catch (error) {
    console.error('Error calculating attendance stats:', error);
    throw error;
  }
};

const attendanceService = {
  // ... existing service methods ...
};

export default attendanceService; 