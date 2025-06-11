import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { format } from 'date-fns';

const calculateStatus = (totalHours: number): string => {
  if (totalHours >= 8) return 'Present';
  if (totalHours >= 4) return 'Half Day';
  return 'On Leave';
};

const processAttendanceCollection = async (
  db: admin.firestore.Firestore,
  collectionName: string,
  dateStr: string,
  monthStr: string,
  yearStr: string,
  now: admin.firestore.Timestamp
): Promise<number> => {
  const attendanceRef = db.collection(collectionName);
  const querySnapshot = await attendanceRef
    .where('date', '==', dateStr)
    .where('month', '==', monthStr)
    .where('year', '==', yearStr)
    .where('punchOut', '==', '')
    .get();

  const batch = db.batch();
  let updateCount = 0;

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.punchIn && !data.punchOut) {
      try {
        // Validate punch-in time format
        const punchInTime = data.punchIn;
        if (!/^\d{2}:\d{2}$/.test(punchInTime)) {
          console.error(`Invalid punch-in time format for document ${doc.id}: ${punchInTime}`);
          return;
        }

        // Calculate total hours
        const [inHours, inMinutes] = punchInTime.split(':').map(Number);
        if (isNaN(inHours) || isNaN(inMinutes) || inHours < 0 || inHours > 23 || inMinutes < 0 || inMinutes > 59) {
          console.error(`Invalid punch-in time values for document ${doc.id}: ${punchInTime}`);
          return;
        }

        const totalInMinutes = inHours * 60 + inMinutes;
        const totalOutMinutes = 23 * 60 + 59; // 23:59
        const totalHours = (totalOutMinutes - totalInMinutes) / 60;

        // Update the document
        batch.update(doc.ref, {
          punchOut: '23:59',
          totalHours: totalHours,
          status: calculateStatus(totalHours),
          lastUpdated: now,
          isAutoPunchOut: true
        });
        updateCount++;
      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
      }
    }
  });

  if (updateCount > 0) {
    await batch.commit();
    console.log(`Auto punch-out completed for ${updateCount} records in ${collectionName}`);
  }

  return updateCount;
};

export const autoPunchOut = functions.scheduler.onSchedule({
  schedule: '59 23 * * *',
  timeZone: 'Asia/Kolkata',
  retryCount: 3
}, async (event) => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const today = new Date();
  
  // Format date for query
  const dateStr = format(today, 'dd');
  const monthStr = format(today, 'MM');
  const yearStr = format(today, 'yyyy');

  try {
    // Process both BDM and Telecaller attendance
    const bdmCount = await processAttendanceCollection(
      db,
      'bdm_monthly_attendance',
      dateStr,
      monthStr,
      yearStr,
      now
    );

    const telecallerCount = await processAttendanceCollection(
      db,
      'telecaller_monthly_attendance',
      dateStr,
      monthStr,
      yearStr,
      now
    );

    const totalCount = bdmCount + telecallerCount;
    
    if (totalCount > 0) {
      console.log(`Auto punch-out completed for total ${totalCount} records (BDM: ${bdmCount}, Telecaller: ${telecallerCount})`);
    } else {
      console.log('No records needed auto punch-out');
    }
  } catch (error) {
    console.error('Error in auto punch-out:', error);
    throw error;
  }
}); 