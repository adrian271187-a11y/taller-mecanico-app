import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDo4Ifs_nF68tm5IZnHnm7O9PRijnwnJEg",
  authDomain: "taller-automotriz-ab5ca.firebaseapp.com",
  projectId: "taller-automotriz-ab5ca",
  storageBucket: "taller-automotriz-ab5ca.firebasestorage.app",
  messagingSenderId: "207967270023",
  appId: "1:207967270023:web:4f4b33daa2c7cc9b6e7422",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export default app;
