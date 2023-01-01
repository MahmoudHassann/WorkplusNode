// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';
  

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCIfxkrOMKWBF36fi9x8J39oHbN1YuTqQs",
  authDomain: "bfcai-7c34e.firebaseapp.com",
  databaseURL: "https://bfcai-7c34e-default-rtdb.firebaseio.com",
  projectId: "bfcai-7c34e",
  storageBucket: "bfcai-7c34e.appspot.com",
  messagingSenderId: "286983410450",
  appId: "1:286983410450:web:518f2554d70a323c7dd9cb",
  measurementId: "G-FJP1WK3SQC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
