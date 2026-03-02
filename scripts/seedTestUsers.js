const dotenv = require("dotenv");
const bcrypt = require("bcrypt");

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.development",
});

const connectDB = require("../config/db");
const admin = require("../config/firebase");
const User = require("../models/User");

const TEST_MOBILES = [
  "1111111111",
  "2222222222",
  "3333333333",
  "4444444444",
  "5555555555",
];

const DEFAULT_PASSWORD = "welcome123";

async function main() {
  try {
    await connectDB();

    for (const mobile of TEST_MOBILES) {
      const email = `${mobile}@pran.com`;

      try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          console.log("Mongo User already exists, skipping:", email);
          continue;
        }

        let firebaseUser;
        try {
          firebaseUser = await admin.auth().createUser({
            email,
            password: DEFAULT_PASSWORD,
            emailVerified: true,
          });
          console.log("Created Firebase user:", email);
        } catch (err) {
          if (err.code === "auth/email-already-exists") {
            firebaseUser = await admin.auth().getUserByEmail(email);
            console.log("Firebase user already exists, reusing:", email);
          } else {
            console.error("Failed to create Firebase user for", email, "-", err.message);
            continue;
          }
        }

        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        const userDoc = new User({
          email,
          password: hashedPassword,
          firebaseUid: firebaseUser.uid,
          firebaseToken: "INITIAL_SETUP",
          lastLogin: new Date(),
        });

        await userDoc.save();
        console.log("Created Mongo Users entry for:", email);
      } catch (err) {
        console.error("Error processing test mobile", mobile, "-", err.message);
      }
    }

    console.log("Seeding of test users completed.");
  } catch (err) {
    console.error("Seeding test users failed:", err.message);
  } finally {
    process.exit(0);
  }
}

main();

