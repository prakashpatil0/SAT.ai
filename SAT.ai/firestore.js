import { db, auth } from "./firebaseConfig"; // Import Firestore & Auth
import { doc, getDoc } from "firebase/firestore";

const checkFirestoreConnection = async () => {
  try {
    const testDocRef = doc(db, "testCollection", "testDocument");
    const testDocSnap = await getDoc(testDocRef);

    if (testDocSnap.exists()) {
      console.log("Firestore is connected!");
    } else {
      console.log("Firestore is connected, but document not found.");
    }
  } catch (error) {
    console.error("Firestore connection failed:", error);
  }
};

// Call this function once in your app
checkFirestoreConnection();
