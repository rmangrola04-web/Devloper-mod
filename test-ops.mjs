import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB5OKNxpdv2mgRkCt0oIsvM8MLoS2zKb8A",
  authDomain: "ich-indore-v3.firebaseapp.com",
  projectId: "ich-indore-v3",
  storageBucket: "ich-indore-v3.firebasestorage.app",
  messagingSenderId: "300004032729",
  appId: "1:300004032729:web:ff8b48d345f8fa9189bec8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const snap = await getDocs(collection(db, "ich_operations"));
  console.log("Total ops:", snap.size);
  snap.forEach(doc => console.log(doc.id, doc.data()));
}
check();
