import { auth, db } from '@/firebaseConfig';
import { collection, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { Timestamp } from 'firebase/firestore';

// Interface for target data
interface FirebaseTargetData {
  closingAmount: number;
  createdAt: Timestamp;
  dateOfJoining: string;
  emailId: string;
  employeeId: string;
  employeeName: string;
  meetingDuration: string;
  numMeetings: number;
  positiveLeads: number;
  updatedAt: Timestamp | string;
}

// Format duration function
const formatDuration = (totalHours: number) => {
  const totalSeconds = Math.round(totalHours * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Initialize notification service
export const initializeNotificationService = async () => {
  // Request notification permissions
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('Notification permissions not granted');
    return;
  }

  // Configure notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // Start listening for target updates
  initializeTargetNotificationListener();
};

// Initialize target notification listener
export const initializeTargetNotificationListener = async () => {
  // Ensure user is authenticated
  if (!auth.currentUser) {
    console.warn('No authenticated user');
    return;
  }

  const userDoc = doc(db, 'users', auth.currentUser.uid);
  let employeeId: string | null = null;
  let userEmail = auth.currentUser.email || '';

  // Listen for user data to get employeeId
  const unsubscribeUser = onSnapshot(userDoc, (doc) => {
    if (doc.exists()) {
      const userData = doc.data();
      employeeId = userData.employeeId;
      userEmail = userData.email || userEmail;

      // Set up target listener
      const targetDataRef = collection(db, 'telecaller_target_data');
      let q;

      if (employeeId) {
        q = query(
          targetDataRef,
          where('employeeId', '==', employeeId),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
      } else {
        q = query(
          targetDataRef,
          where('emailId', '==', userEmail),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
      }

      let previousTargets: FirebaseTargetData | null = null;

      // Listen for target updates
      const unsubscribeTarget = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const targetDoc = snapshot.docs[0].data() as FirebaseTargetData;

          // Check if targets have changed
          if (
            !previousTargets ||
            previousTargets.numMeetings !== targetDoc.numMeetings ||
            previousTargets.meetingDuration !== targetDoc.meetingDuration ||
            previousTargets.positiveLeads !== targetDoc.positiveLeads ||
            previousTargets.closingAmount !== targetDoc.closingAmount
          ) {
            // Prepare notification
            const updateDate = typeof targetDoc.updatedAt === 'string'
              ? targetDoc.updatedAt
              : targetDoc.updatedAt?.toDate().toLocaleDateString() || 'Unknown date';

            // Show notification
            Notifications.scheduleNotificationAsync({
              content: {
                title: 'Target Updated! 🎯',
                body: `Your weekly targets have been updated on ${updateDate}:\n• Calls: ${targetDoc.numMeetings}\n• Duration: ${formatDuration(parseInt(targetDoc.meetingDuration))}\n• Leads: ${targetDoc.positiveLeads}\n• Amount: ₹${targetDoc.closingAmount.toLocaleString()}`,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
              },
              trigger: null,
            });

            // Update previous targets
            previousTargets = targetDoc;
          }
        }
      }, (error) => {
        console.error('Error in target listener:', error);
      });

      // Cleanup target listener
      return () => unsubscribeTarget();
    }
  }, (error) => {
    console.error('Error in user listener:', error);
  });

  // Cleanup user listener
  return () => unsubscribeUser();
};