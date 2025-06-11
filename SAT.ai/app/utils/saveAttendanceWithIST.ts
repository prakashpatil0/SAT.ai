import { addDoc, collection, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toZonedTime, format as formatTz } from 'date-fns-tz';
import { db, auth } from '@/firebaseConfig';

export const saveAttendanceWithIST = async ({
  photoUri,
  latitude,
  longitude,
  locationAddress,
  punchType,
}: {
  photoUri: string;
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  punchType: 'Punch In' | 'Punch Out';
}) => {
  try {
    const docRef = await addDoc(collection(db, 'attendance'), {
      userId: auth.currentUser?.uid,
      photoUrl: photoUri,
      location: {
        latitude,
        longitude,
        address: locationAddress,
      },
      createdAt: serverTimestamp(), // ✅ Firebase Server Time
      punchType,
    });

    const savedDoc = await getDoc(docRef);
    const serverTime = savedDoc.data()?.createdAt?.toDate();

    if (serverTime) {
      const istTime = toZonedTime(serverTime, 'Asia/Kolkata');
      const istTimeString = formatTz(istTime, 'HH:mm:ss');

      const istFullDateTime = formatTz(istTime, 'dd MMM yyyy, hh:mm:ss a');

await updateDoc(docRef, {
  punchIn: punchType === 'Punch In' ? istTimeString : '',
  punchOut: punchType === 'Punch Out' ? istTimeString : '',
  istDateTime: istFullDateTime, // ✅ Full IST datetime
});


      return { istTimeString };
    } else {
      throw new Error('Server timestamp missing.');
    }
  } catch (err) {
    console.error('🔥 Error saving attendance with IST:', err);
    throw err;
  }
};
