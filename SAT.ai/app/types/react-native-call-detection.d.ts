declare module 'react-native-call-detection' {
  export default class CallDetectorManager {
    constructor();
    addEventListener(event: 'Incoming' | 'Outgoing' | 'Disconnected', callback: (number?: string) => void): void;
    dispose(): void;
  }
} 