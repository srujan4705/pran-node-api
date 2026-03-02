const admin = require("firebase-admin");
const dotenv = require("dotenv");

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

if (!firebaseConfig.projectId || !firebaseConfig.privateKey || !firebaseConfig.clientEmail) {
  console.warn("Firebase configuration is missing. Auth features will not work until .env is populated.");
} else {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig)
    });
    console.log("Firebase Admin SDK Initialized");
  } catch (error) {
    console.error("Firebase Admin SDK Initialization Error:", error);
  }
}

module.exports = admin;
