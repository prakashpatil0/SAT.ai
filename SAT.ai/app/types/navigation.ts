import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  // Auth Screens
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;

  // Main App Screens
  MainApp: undefined;
  Profile: undefined;

  // BDM Screens
  BDMHomeScreen: undefined;
  MeetingDetails: { meetingId: string };
  DealDetails: { dealId: string };
  Meetings: undefined;
  Deals: undefined;
  NewMeeting: undefined;
  NewDeal: undefined;
  Companies: undefined;
  CompanyDetails: { companyId: string };
  NewCompany: undefined;
  Activities: undefined;

  // Telecaller Screens
  TelecallerHomeScreen: undefined;
  TelecallerCallNoteDetails: { 
    meeting: {
      id: string;
      phoneNumber: string;
      timestamp: Date;
      duration: number;
      type: 'incoming' | 'outgoing' | 'missed';
      status: 'completed' | 'missed' | 'in-progress';
      contactId?: string;
      contactName?: string;
    }
  };
  TelecallerCreateFollowUp: { 
    meeting: {
      id: string;
      phoneNumber: string;
      timestamp: Date;
      duration: number;
      type: 'incoming' | 'outgoing' | 'missed';
      status: 'completed' | 'missed' | 'in-progress';
      contactId?: string;
      contactName?: string;
    }
  };
  TelecallerMyScheduleScreen: undefined;
  AddContactModal: { 
    phoneNumber: string;
    onContactSaved?: () => void;
  };
  CallHistory: { 
    call: Array<{
      id: string;
      phoneNumber: string;
      timestamp: Date;
      duration: number;
      type: 'incoming' | 'outgoing' | 'missed';
      status: 'completed' | 'missed' | 'in-progress';
      contactId?: string;
      contactName?: string;
    }>;
    phoneNumber: string;
    contactName?: string;
  };
  ContactInfo: { 
    contact: {
      id: string;
      phoneNumber: string;
      timestamp: Date;
      duration: number;
      type: 'incoming' | 'outgoing' | 'missed';
      status: 'completed' | 'missed' | 'in-progress';
      contactId?: string;
      contactName?: string;
      isNewContact: boolean;
    }
  };
  TelecallerIdleTimer: { activateImmediately: boolean };
}; 