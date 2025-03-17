import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { CONFIG } from '../config/config';
import api from '../services/api';

interface BackendContextType {
  isConnected: boolean;
  makeRequest: (method: string, endpoint: string, data?: any) => Promise<any>;
}

const BackendContext = createContext<BackendContextType | null>(null);

export const BackendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastConnectionLog, setLastConnectionLog] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const verifyBackendConnection = async (isSilent: boolean = false) => {
    try {
      const now = Date.now();
      const shouldLog = !isSilent && (now - lastConnectionLog > 300000);

      const isConnected = await fetch(`${CONFIG.BACKEND_URL}/health`).then(() => true).catch(() => false);
      
      if (isConnected) {
        setIsConnected(true);
        setRetryCount(0);
        
        if (shouldLog) {
          console.log('✅ Backend server connected successfully');
          setLastConnectionLog(now);
        }
      }
    } catch (error) {
      setIsConnected(false);
      setRetryCount(prev => prev + 1);
      
      if (!isSilent && retryCount >= CONFIG.RETRY_CONFIG.MAX_RETRIES) {
        console.error('⚠️ Backend connection failed after maximum retries');
      }
    }
  };

  const makeRequest = async (method: string, endpoint: string, data?: any) => {
    if (!isConnected) {
      await verifyBackendConnection();
      if (!isConnected) {
        throw new Error('No backend connection available');
      }
    }

    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });
      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        console.error('Request Error:', error.message);
      }
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasConnected = isConnected;
      const newIsConnected = state.isConnected ?? false;
      
      if (!wasConnected && newIsConnected) {
        verifyBackendConnection();
      }
      setIsConnected(newIsConnected);
    });

    // Initial connection check
    verifyBackendConnection();

    // Periodic connection check
    const interval = setInterval(() => {
      verifyBackendConnection(true);
    }, CONFIG.RETRY_CONFIG.RETRY_INTERVAL);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isConnected]);

  return (
    <BackendContext.Provider value={{ isConnected, makeRequest }}>
      {children}
    </BackendContext.Provider>
  );
};

export const useBackend = () => {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error('useBackend must be used within a BackendProvider');
  }
  return context;
}; 