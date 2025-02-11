// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBe0kFne8vQpdpbJjsQtDV4jOpIVSHPM-s",
  authDomain: "app-suini.firebaseapp.com",
  projectId: "app-suini",
  storageBucket: "app-suini.firebasestorage.app",
  messagingSenderId: "374795811050",
  appId: "1:374795811050:web:b161b1155939dad4c7ff93",
  measurementId: "G-D43TX2BS3F"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
