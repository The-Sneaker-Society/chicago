import { initializeApp } from "firebase/app";

const firebaseConfig = {
    apiKey: "AIzaSyD0hRrAj70bXNU1FC_99600jXynzPuID6E",
    authDomain: "sneaker-society.firebaseapp.com",
    projectId: "sneaker-society",
    storageBucket: "sneaker-society.appspot.com",
    messagingSenderId: "903067817008",
    appId: "1:903067817008:web:2d69e610120d76f4ca89f5",
    measurementId: "G-5DF9HGJTMY"
};

export const app = initializeApp(firebaseConfig);