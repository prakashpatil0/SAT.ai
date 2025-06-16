declare module 'react-native-call-log' {
  interface CallLogEntry {
    phoneNumber: string;
    timestamp: string;
    duration: number;
    type: string;
    name?: string;
  }

  interface CallLog {
    load: (limit: number) => Promise<CallLogEntry[]>;
    loadAll: () => Promise<CallLogEntry[]>;
    load: (options: { limit: number; filter?: string }) => Promise<CallLogEntry[]>;
  }

  const CallLog: CallLog;
  export default CallLog;
} 