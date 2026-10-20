import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const docRef = await addDoc(collection(db, "ich_operations"), {
      test: "data",
      updatedAt: new Date().toISOString()
    });
    console.log("Success: ", docRef.id);
    await deleteDoc(doc(db, "ich_operations", docRef.id));
    console.log("Cleanup succeeded");
    process.exit(0);
  } catch (e) {
    console.error("Error: ", e);
    process.exit(1);
  }
}
test();

