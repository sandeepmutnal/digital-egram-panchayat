// firebase-config.js

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_REAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

// Initialize Firebase using compat
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Export globally so auth.js can use them
window.auth = auth;
window.db = db;
window.storage = storage;
