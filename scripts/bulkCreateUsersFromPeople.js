const dotenv = require("dotenv");
const bcrypt = require("bcrypt");

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.development",
});

const connectDB = require("../config/db");
const admin = require("../config/firebase");
const Person = require("../models/Person");
const User = require("../models/User");

const DEFAULT_PASSWORD = "welcome123";

async function main() {
  try {
    await connectDB();

    const people = await Person.find({});
    console.log(`Found ${people.length} people records`);

    for (const person of people) {
      const mobile = person.mobileNumber && String(person.mobileNumber).trim();
      const emailFromPerson = person.email && person.email.trim();

      if (!mobile && !emailFromPerson) {
        console.warn("Skipping person without mobile/email:", person._id.toString());
        continue;
      }

      const email = mobile ? `${mobile}@pran.com` : emailFromPerson.toLowerCase();

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
        console.error("Error processing person", person._id.toString(), "-", err.message);
      }
    }

    console.log("Bulk user creation completed.");
  } catch (err) {
    console.error("Bulk user creation failed:", err.message);
  } finally {
    process.exit(0);
  }
}

main();
