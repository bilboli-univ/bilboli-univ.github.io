const firebaseConfig = {
  apiKey: "AIzaSyDe3Mpmcd5zNZz7CJ0RHP1RxeM8tA_-aLM",
  authDomain: "findmeonphoto.firebaseapp.com",
  projectId: "findmeonphoto",
  storageBucket: "findmeonphoto.firebasestorage.app",
  messagingSenderId: "78625732870",
  appId: "1:78625732870:web:5d0c849462c83df2220687",
  measurementId: "G-BMBGZBB1PF"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
