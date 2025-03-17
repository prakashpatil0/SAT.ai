declare module 'react-native-call-log' {
  interface CallLogEntry {
    phoneNumber: string;
    timestamp: string;
    type: string;
    duration: number;
  }

  export function loadAll(): Promise<CallLogEntry[]>;
} 