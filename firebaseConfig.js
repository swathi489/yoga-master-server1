// firebase.js
const { initializeApp } = require('firebase/app');
const { getStorage } = require('firebase/storage');

const firebaseConfig = {
  apiKey: "AIzaSyBE1MtRR0zoQGjHMi3gQBzko0N5nuhTP0A",
  authDomain: "yoga-master-demo-bce33.firebaseapp.com",
  projectId: "yoga-master-demo-bce33",
  storageBucket: "yoga-master-demo-bce33.appspot.com",
  messagingSenderId: "1057764773246",
  appId: "1:1057764773246:web:355d7daeca3b505f72772f"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

module.exports = { storage };
