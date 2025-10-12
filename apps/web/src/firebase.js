import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // apiKey: "AIzaSyCDuNBaceQHNRRmbX2j-VR04O6churBDv0",
  // authDomain: "athletecentralapp.firebaseapp.com",
  // projectId: "athletecentralapp",
  // storageBucket: "athletecentralapp.firebasestorage.app",
  // messagingSenderId: "441858099025",
  // appId: "1:441858099025:web:93d03303b3d3e68dfc7570",
  apiKey: "AIzaSyDkwjToOJkN3moRCxqNLNyXnaGeUklpv0Q",
  authDomain: "athletehub-1d138.firebaseapp.com",
  projectId: "athletehub-1d138",
  storageBucket: "athletehub-1d138.firebasestorage.app",
  messagingSenderId: "95519361453",
  appId: "1:95519361453:web:93d03303b3d3e68dfc7570",
  measurementId: "G-2KBV24PZCX" 
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
