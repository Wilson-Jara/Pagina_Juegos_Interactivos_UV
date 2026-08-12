import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const FIREBASE_ADMIN_EMAIL = 'wilsonjara101@gmail.com';
export const FIREBASE_ADMIN_USERNAME = 'Wilson';

const firebaseConfig = {
    apiKey: 'AIzaSyDvWxHAtHy7sacovnxQKeg-QhgGqrcr7bA',
    authDomain: 'juegosinteractivoscam.firebaseapp.com',
    projectId: 'juegosinteractivoscam',
    storageBucket: 'juegosinteractivoscam.firebasestorage.app',
    messagingSenderId: '605301173257',
    appId: '1:605301173257:web:021a87aa5d8a989ee81cd8',
    measurementId: 'G-4WG6YS194T',
};

export const isFirebaseConfigured = true;
export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
