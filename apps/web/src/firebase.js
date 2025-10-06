import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCDuNBaceQHNRRmbX2j-VR04O6churBDv0",
  authDomain: "athletecentralapp.firebaseapp.com",
  projectId: "athletecentralapp",
  storageBucket: "athletecentralapp.firebasestorage.app",
  messagingSenderId: "441858099025",
  appId: "1:441858099025:web:93d03303b3d3e68dfc7570",
  measurementId: "G-2KBV24PZCX" 
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
