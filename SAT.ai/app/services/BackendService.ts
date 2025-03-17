// import axios from 'axios';
// import NetInfo from '@react-native-community/netinfo';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { CONFIG } from '../config/config';
// import api from './api';

// class BackendService {
//   private static instance: BackendService;
//   private isConnected: boolean = false;
//   private lastConnectionLog: number = 0;
//   private connectionCheckInterval: NodeJS.Timeout | null = null;
//   private retryCount: number = 0;

//   private constructor() {
//     this.setupConnectionMonitoring();
//   }

//   public static getInstance(): BackendService {
//     if (!BackendService.instance) {
//       BackendService.instance = new BackendService();
//     }
//     return BackendService.instance;
//   }

//   private setupConnectionMonitoring() {
//     // Monitor network connectivity
//     NetInfo.addEventListener(state => {
//       const wasConnected = this.isConnected;
//       this.isConnected = state.isConnected ?? false;
      
//       if (!wasConnected && this.isConnected) {
//         // Only verify connection when transitioning from disconnected to connected
//         this.verifyBackendConnection();
//       }
//     });

//     // Reduced frequency of connection checks
//     this.connectionCheckInterval = setInterval(() => {
//       this.verifyBackendConnection(true);
//     }, CONFIG.RETRY_CONFIG.RETRY_INTERVAL);
//   }

//   private async verifyBackendConnection(isSilent: boolean = false) {
//     try {
//       const now = Date.now();
//       const shouldLog = !isSilent && (now - this.lastConnectionLog > 300000);

//       // Add timeout to the health check request
//       const isConnected = await Promise.race([
//         this.makeRequest('GET', '/health'),
//         new Promise((_, reject) => 
//           setTimeout(() => reject(new Error('Connection timeout')), CONFIG.API_TIMEOUT)
//         )
//       ]);
      
//       if (isConnected) {
//         this.isConnected = true;
//         this.retryCount = 0;
        
//         if (shouldLog) {
//           console.log('✅ Backend server connected successfully');
//           this.lastConnectionLog = now;
//         }
//       }
//     } catch (error) {
//       this.isConnected = false;
      
//       // Implement exponential backoff
//       const backoffTime = Math.min(
//         1000 * Math.pow(2, this.retryCount),
//         CONFIG.RETRY_CONFIG.MAX_BACKOFF || 30000
//       );
      
//       if (!isSilent) {
//         if (this.retryCount < CONFIG.RETRY_CONFIG.MAX_RETRIES) {
//           console.log(`Retrying connection in ${backoffTime/1000} seconds... (Attempt ${this.retryCount + 1}/${CONFIG.RETRY_CONFIG.MAX_RETRIES})`);
//           await new Promise(resolve => setTimeout(resolve, backoffTime));
//           this.retryCount++;
//           return this.verifyBackendConnection(isSilent);
//         } else {
//           this.handleConnectionFailure();
//         }
//       }
//     }
//   }

//   private handleConnectionFailure() {
//     // Enhanced error handling
//     const errorMessage = '⚠️ Backend connection failed after maximum retries';
//     console.error(errorMessage);
    
//     // Reset retry count after some time to allow fresh attempts
//     setTimeout(() => {
//       this.retryCount = 0;
//     }, CONFIG.RETRY_CONFIG.RESET_TIMEOUT || 60000);

//     // Emit event for UI handling if needed
//     if (typeof global.EventEmitter !== 'undefined') {
//       global.EventEmitter?.emit('BACKEND_CONNECTION_FAILED', {
//         message: errorMessage,
//         timestamp: new Date().toISOString()
//       });
//     }
//   }

//   public async makeRequest(method: string, endpoint: string, data?: any) {
//     if (!this.isConnected) {
//       await this.verifyBackendConnection();
//       if (!this.isConnected) {
//         throw new Error('No backend connection available');
//       }
//     }

//     try {
//       const response = await axios({
//         method,
//         url: `${CONFIG.BACKEND_URL}${endpoint}`,
//         data,
//         timeout: CONFIG.API_TIMEOUT
//       });
//       return response.data;
//     } catch (error) {
//       this.handleRequestError(error);
//       throw error;
//     }
//   }

//   private handleRequestError(error: any) {
//     // Only log actual errors, not connection checks
//     if (error.response?.status !== 404) {
//       if (error.response) {
//         console.error('Server Error:', error.response.status);
//       } else if (error.request) {
//         console.error('No Response Error');
//       }
//     }
//   }

//   public isBackendConnected(): boolean {
//     return this.isConnected;
//   }

//   public cleanup() {
//     if (this.connectionCheckInterval) {
//       clearInterval(this.connectionCheckInterval);
//     }
//   }
// }

// export default BackendService.getInstance(); 