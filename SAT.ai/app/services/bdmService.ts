import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  serverTimestamp,
  FieldValue 
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';

// Types
export interface BDMUser {
  uid: string;
  email: string;
  role: 'bdm';
  name: string;
  phone: string;
  profileImage?: string;
  createdAt: Date;
  lastLogin: Date;
}

export interface BDMMeeting {
  id?: string;
  bdmId: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  meetingDate: Date;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string;
  followUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BDMContact {
  id?: string;
  bdmId: string;
  name: string;
  company: string;
  role: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BDMNote {
  id?: string;
  bdmId: string;
  title: string;
  content: string;
  type: 'meeting' | 'contact' | 'general';
  relatedId?: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BDMReport {
  id?: string;
  bdmId: string;
  date: Date;
  numberOfMeetings: number;
  totalDuration: number;
  positiveLeads: number;
  closingAmount: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Meeting {
  id?: string;
  bdmId: string;
  companyId: string;
  contactId: string;
  purpose: string;
  type: 'physical' | 'virtual';
  date: Date | Timestamp;
  startTime: Date | Timestamp;
  endTime: Date | Timestamp;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  location?: string;
  notes: string;
  attachments?: string[];
  followUpDate?: Date | Timestamp;
  outcome?: string;
  createdAt: Date | Timestamp | FieldValue;
  updatedAt: Date | Timestamp | FieldValue;
}

export interface Company {
  id?: string;
  name: string;
  assignedBdm: string;
  industry: string;
  size: string;
  status: 'lead' | 'prospect' | 'customer' | 'inactive';
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
  };
  website?: string;
  linkedIn?: string;
  revenue?: number;
  employeeCount?: number;
  createdAt: Date | Timestamp | FieldValue;
  updatedAt: Date | Timestamp | FieldValue;
}

export interface Contact {
  id?: string;
  companyId: string;
  name: string;
  designation: string;
  phone: string;
  email: string;
  isDecisionMaker: boolean;
  preferredContactMethod: 'phone' | 'email' | 'whatsapp';
  notes: string;
  lastContactedDate?: Date | Timestamp;
  createdAt: Date | Timestamp | FieldValue;
  updatedAt: Date | Timestamp | FieldValue;
}

export interface Deal {
  id?: string;
  bdmId: string;
  companyId: string;
  title: string;
  value: number;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  probability: number;
  expectedClosingDate: Date | Timestamp;
  actualClosingDate?: Date | Timestamp;
  products: string[];
  notes: string;
  history: {
    stage: string;
    date: Date | Timestamp;
    notes: string;
  }[];
  createdAt: Date | Timestamp | FieldValue;
  updatedAt: Date | Timestamp | FieldValue;
}

export interface Activity {
  id?: string;
  bdmId: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  relatedTo: {
    type: 'company' | 'contact' | 'deal' | 'meeting';
    id: string;
  };
  description: string;
  outcome?: string;
  duration?: number;
  date: Date | Timestamp;
  createdAt: Date | Timestamp | FieldValue;
  updatedAt: Date | Timestamp | FieldValue;
}

// BDM Meetings
export const createBDMMeeting = async (meeting: Omit<BDMMeeting, 'id' | 'createdAt' | 'updatedAt'>) => {
  const meetingData = {
    ...meeting,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  const docRef = await addDoc(collection(db, 'bdm_meetings'), meetingData);
  return docRef.id;
};

export const getBDMMeetings = async (bdmId: string) => {
  const q = query(
    collection(db, 'bdm_meetings'),
    where('bdmId', '==', bdmId),
    orderBy('meetingDate', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as BDMMeeting[];
};

// BDM Contacts
export const createBDMContact = async (contact: Omit<BDMContact, 'id' | 'createdAt' | 'updatedAt'>) => {
  const contactData = {
    ...contact,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  const docRef = await addDoc(collection(db, 'bdm_contacts'), contactData);
  return docRef.id;
};

export const getBDMContacts = async (bdmId: string) => {
  const q = query(
    collection(db, 'bdm_contacts'),
    where('bdmId', '==', bdmId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as BDMContact[];
};

// BDM Notes
export const createBDMNote = async (note: Omit<BDMNote, 'id' | 'createdAt' | 'updatedAt'>) => {
  const noteData = {
    ...note,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  const docRef = await addDoc(collection(db, 'bdm_notes'), noteData);
  return docRef.id;
};

export const getBDMNotes = async (bdmId: string) => {
  const q = query(
    collection(db, 'bdm_notes'),
    where('bdmId', '==', bdmId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as BDMNote[];
};

// BDM Reports
export const createBDMReport = async (report: Omit<BDMReport, 'id' | 'createdAt' | 'updatedAt'>) => {
  const reportData = {
    ...report,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  const docRef = await addDoc(collection(db, 'bdm_reports'), reportData);
  return docRef.id;
};

export const getBDMReports = async (bdmId: string) => {
  const q = query(
    collection(db, 'bdm_reports'),
    where('bdmId', '==', bdmId),
    orderBy('date', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as BDMReport[];
};

// Update functions
export const updateBDMMeeting = async (meetingId: string, updates: Partial<BDMMeeting>) => {
  const meetingRef = doc(db, 'bdm_meetings', meetingId);
  await updateDoc(meetingRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
};

export const updateBDMContact = async (contactId: string, updates: Partial<BDMContact>) => {
  const contactRef = doc(db, 'bdm_contacts', contactId);
  await updateDoc(contactRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
};

export const updateBDMNote = async (noteId: string, updates: Partial<BDMNote>) => {
  const noteRef = doc(db, 'bdm_notes', noteId);
  await updateDoc(noteRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
};

export const updateBDMReport = async (reportId: string, updates: Partial<BDMReport>) => {
  const reportRef = doc(db, 'bdm_reports', reportId);
  await updateDoc(reportRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
};

// Delete functions
export const deleteBDMMeeting = async (meetingId: string) => {
  await deleteDoc(doc(db, 'bdm_meetings', meetingId));
};

export const deleteBDMContact = async (contactId: string) => {
  await deleteDoc(doc(db, 'bdm_contacts', contactId));
};

export const deleteBDMNote = async (noteId: string) => {
  await deleteDoc(doc(db, 'bdm_notes', noteId));
};

export const deleteBDMReport = async (reportId: string) => {
  await deleteDoc(doc(db, 'bdm_reports', reportId));
};

// BDM Service Class
const bdmService = {
  // Meetings
  async createMeeting(meeting: Meeting): Promise<Meeting> {
    try {
      const meetingData = {
        ...meeting,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'meetings'), meetingData);
      return { id: docRef.id, ...meetingData };
    } catch (error) {
      console.error('Error creating meeting:', error);
      throw error;
    }
  },

  async updateMeeting(meetingId: string, updates: Partial<Meeting>): Promise<void> {
    try {
      const meetingRef = doc(db, 'meetings', meetingId);
      await updateDoc(meetingRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating meeting:', error);
      throw error;
    }
  },

  async getBDMMeetings(bdmId: string): Promise<Meeting[]> {
    try {
      const q = query(
        collection(db, 'meetings'),
        where('bdmId', '==', bdmId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Meeting));
    } catch (error) {
      console.error('Error fetching BDM meetings:', error);
      throw error;
    }
  },

  // Companies
  async createCompany(company: Company): Promise<Company> {
    try {
      const companyData = {
        ...company,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'companies'), companyData);
      return { id: docRef.id, ...companyData };
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  },

  async updateCompany(companyId: string, updates: Partial<Company>): Promise<void> {
    try {
      const companyRef = doc(db, 'companies', companyId);
      await updateDoc(companyRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  },

  async getBDMCompanies(bdmId: string): Promise<Company[]> {
    try {
      const q = query(
        collection(db, 'companies'),
        where('assignedBdm', '==', bdmId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Company));
    } catch (error) {
      console.error('Error fetching BDM companies:', error);
      throw error;
    }
  },

  // Deals
  async createDeal(deal: Deal): Promise<Deal> {
    try {
      const dealData = {
        ...deal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'deals'), dealData);
      return { id: docRef.id, ...dealData };
    } catch (error) {
      console.error('Error creating deal:', error);
      throw error;
    }
  },

  async updateDeal(dealId: string, updates: Partial<Deal>): Promise<void> {
    try {
      const dealRef = doc(db, 'deals', dealId);
      await updateDoc(dealRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating deal:', error);
      throw error;
    }
  },

  async getBDMDeals(bdmId: string): Promise<Deal[]> {
    try {
      const q = query(
        collection(db, 'deals'),
        where('bdmId', '==', bdmId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Deal));
    } catch (error) {
      console.error('Error fetching BDM deals:', error);
      throw error;
    }
  },

  // Activities
  async logActivity(activity: Activity): Promise<Activity> {
    try {
      const activityData = {
        ...activity,
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'activities'), activityData);
      return { id: docRef.id, ...activityData };
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  },

  async getBDMActivities(bdmId: string): Promise<Activity[]> {
    try {
      const q = query(
        collection(db, 'activities'),
        where('bdmId', '==', bdmId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Activity));
    } catch (error) {
      console.error('Error fetching BDM activities:', error);
      throw error;
    }
  }
};

export default bdmService; 