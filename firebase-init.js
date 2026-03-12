// Firebase SDK imports (ES modules from CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut }
  from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, updateDoc }
  from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// ── Firebase config — replace with your project's values ──
const firebaseConfig = {
  apiKey: "AIzaSyBtjQE76mHJGVCIDqlkVuVXq_01ogM7lqw",
  authDomain: "eqarcom-dashboard.firebaseapp.com",
  projectId: "eqarcom-dashboard",
  storageBucket: "eqarcom-dashboard.firebasestorage.app",
  messagingSenderId: "859501858708",
  appId: "1:859501858708:web:ae32ef5ce5541cf0ab0981"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = 'abbas.hayat@al-ghurair.com';

export {
  auth, db, ADMIN_EMAIL,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  doc, getDoc, setDoc, getDocs, collection, updateDoc
};
