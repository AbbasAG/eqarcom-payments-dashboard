// Firebase SDK imports (ES modules from CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut }
  from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, updateDoc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { getStorage, ref as storageRef, getBlob, uploadBytes, getMetadata }
  from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js';

// ── Firebase config ──
// Note: API keys for Firebase web apps are public by design. Access control
// is enforced by Firestore + Storage security rules and (recommended)
// API-key HTTP-referrer restrictions in Google Cloud Console.
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
const storage = getStorage(app);

const ADMIN_EMAIL = 'abbas.hayat@al-ghurair.com';

// ── Secure data fetch helpers ─────────────────────────────────
// All sensitive extracts live under /private/ in Cloud Storage.
// Reads require an authenticated user with the right permission flag
// (enforced in storage.rules). Returns { text, updated } where `updated`
// is a Date taken from the object's metadata.
async function fetchPrivateText(path) {
  const r = storageRef(storage, path);
  const [blob, meta] = await Promise.all([getBlob(r), getMetadata(r)]);
  return {
    text: await blob.text(),
    updated: meta.updated ? new Date(meta.updated) : null
  };
}
async function fetchPrivateJson(path) {
  const { text, updated } = await fetchPrivateText(path);
  return { json: JSON.parse(text), updated };
}

export {
  auth, db, storage, ADMIN_EMAIL,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  doc, getDoc, setDoc, getDocs, collection, updateDoc, deleteDoc,
  storageRef, getBlob, uploadBytes, getMetadata,
  fetchPrivateText, fetchPrivateJson
};
