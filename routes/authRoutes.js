const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const admin = require("../config/firebase");
const User = require("../models/User");
const Person = require("../models/Person");

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - user_name
 *         - pass_key
 *       properties:
 *         user_name:
 *           type: string
 *           description: User's email
 *           example: "pandirisaisrujan@gmail.com"
 *         pass_key:
 *           type: string
 *           description: User's password
 *           example: "your_password_here"
 *     SignupRequest:
 *       type: object
 *       required:
 *         - user_name
 *         - pass_key
 *         - fullName
 *         - mobileNumber
 *         - profession
 *         - addressForCommunication
 *       properties:
 *         user_name:
 *           type: string
 *           description: User's email
 *           example: "newuser@gmail.com"
 *         pass_key:
 *           type: string
 *           description: User's password
 *           example: "password123"
 *         fullName:
 *           type: string
 *           example: "John Doe"
 *         mobileNumber:
 *           type: string
 *           example: "9876543210"
 *         dateOfBirth:
 *           type: string
 *           example: "1995-05-15"
 *         dateOfMarriage:
 *           type: string
 *           example: "2020-10-20"
 *         profession:
 *           type: object
 *           properties:
 *             title:
 *               type: string
 *               example: "Software Engineer"
 *             description:
 *               type: string
 *               example: "Full Stack Developer"
 *         addressForCommunication:
 *           type: object
 *           properties:
 *             street1:
 *               type: string
 *               example: "123 Main St"
 *             street2:
 *               type: string
 *               example: "Apt 4B"
 *             city:
 *               type: string
 *               example: "Hyderabad"
 *             district:
 *               type: string
 *               example: "Hyderabad"
 *             state:
 *               type: string
 *               example: "Telangana"
 *             country:
 *               type: string
 *               example: "India"
 *             pincode:
 *               type: string
 *               example: "500001"
 *         profilePhoto:
 *           type: string
 *           example: "https://example.com/photo.jpg"
 *         bloodGroup:
 *           type: string
 *           example: "O+"
 *         qualification:
 *           type: string
 *           example: "B.Tech"
 *     AuthRequest:
 *       type: object
 *       required:
 *         - firebaseToken
 *       properties:
 *         firebaseToken:
 *           type: string
 *           example: "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
 *     AuthGoogleTokenRequest:
 *       type: object
 *       required:
 *         - idToken
 *       properties:
 *         idToken:
 *           type: string
 *           description: The ID token received from the Firebase Client SDK / Google Login
 *           example: "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user (Firebase Auth + Users Table + People Table) - Patterns provided
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *     responses:
 *       201:
 *         description: User registered successfully in all systems
 *       200:
 *         description: Existing user profile updated successfully
 *       400:
 *         description: User already exists or invalid data
 *       500:
 *         description: Server error
 */
router.post("/signup", async (req, res) => {
  const { 
    user_name, 
    pass_key, 
    fullName, 
    mobileNumber, 
    dateOfBirth, 
    dateOfMarriage, 
    profession, 
    addressForCommunication, 
    profilePhoto, 
    bloodGroup, 
    qualification
  } = req.body;

  // We don't expect firebase_uid from the body for normal signup anymore
  let firebase_uid = req.body.firebase_uid; 

  const normalizedMobileNumber = mobileNumber && String(mobileNumber).trim();

  if (!user_name) {
    return res.status(400).json({ 
      success: false, 
      message: "Email (user_name) is required", 
    });
  }

  try {
    // 🔹 Check if user already exists in MongoDB Users table
    const existingUser = await User.findOne({ email: user_name });

    // ✅ Case 1: Existing user → update profile in People table
    if (existingUser) {
      if (normalizedMobileNumber) {
        const conflict = await Person.findOne({
          mobileNumber: normalizedMobileNumber,
          email: { $ne: user_name }
        });

        if (conflict) {
          return res.status(400).json({
            success: false,
            message: "Mobile number already in use"
          });
        }
      }

      const updatedProfile = await Person.findOneAndUpdate(
        { email: user_name },
        { 
          fullName, 
          mobileNumber: normalizedMobileNumber, 
          dateOfBirth, 
          dateOfMarriage, 
          profession, 
          addressForCommunication, 
          profilePhoto, 
          bloodGroup, 
          qualification 
        },
        { new: true, upsert: true }
      );

      return res.status(200).json({
        success: true,
        message: "Existing user profile updated successfully",
        uid: existingUser.firebaseUid,
        email: user_name,
        profile: updatedProfile,
      });
    }

    // ✅ Case 2: Google user with Firebase UID provided
    if (firebase_uid) {
      const uidCheck = await User.findOne({ firebaseUid: firebase_uid });

      if (!uidCheck) {
        if (!normalizedMobileNumber) {
          return res.status(400).json({
            success: false,
            message: "Mobile number is required"
          });
        }

        const conflict = await Person.findOne({
          mobileNumber: normalizedMobileNumber,
          email: { $ne: user_name }
        });

        if (conflict) {
          return res.status(400).json({
            success: false,
            message: "Mobile number already in use"
          });
        }

        // 🔹 New Google user → insert into Users and People
        const newUser = await User.create({
          email: user_name,
          password: "social_login_no_password",
          firebaseUid: firebase_uid,
          firebaseToken: "social_login"
        });

        const newProfile = await Person.create({
          fullName,
          mobileNumber: normalizedMobileNumber,
          email: user_name,
          dateOfBirth,
          dateOfMarriage,
          profession,
          addressForCommunication,
          profilePhoto,
          bloodGroup,
          qualification
        });

        return res.status(201).json({
          success: true,
          message: "Google user created successfully (minimal record)",
          uid: firebase_uid,
          email: newUser.email,
          profile: newProfile,
        });
      } else {
        // 🔹 Existing Google user → update profile
        if (normalizedMobileNumber) {
          const conflict = await Person.findOne({
            mobileNumber: normalizedMobileNumber,
            email: { $ne: user_name }
          });

          if (conflict) {
            return res.status(400).json({
              success: false,
              message: "Mobile number already in use"
            });
          }
        }

        const updatedProfile = await Person.findOneAndUpdate(
          { email: user_name },
          { fullName, mobileNumber: normalizedMobileNumber, dateOfBirth, dateOfMarriage, profession, addressForCommunication, profilePhoto, bloodGroup, qualification },
          { new: true, upsert: true }
        );

        return res.status(200).json({
          success: true,
          message: "Existing Google user profile updated successfully",
          uid: firebase_uid,
          email: user_name,
          profile: updatedProfile,
        });
      }
    }

    // 3️⃣ New User Flow: Create in Firebase, Users, and People
    if (pass_key) {
      if (!normalizedMobileNumber) {
        return res.status(400).json({
          success: false,
          message: "Mobile number is required"
        });
      }

      const conflict = await Person.findOne({
        mobileNumber: normalizedMobileNumber,
        email: { $ne: user_name }
      });

      if (conflict) {
        return res.status(400).json({
          success: false,
          message: "Mobile number already in use"
        });
      }

      console.log("Creating new user in Firebase...");
      const firebaseUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.FIREBASE_API_KEY}`;

      const firebaseResp = await axios.post(
        firebaseUrl,
        {
          email: user_name,
          password: pass_key,
          returnSecureToken: true,
        },
        { headers: { "Content-Type": "application/json" } }
      );

      const firebaseUid = firebaseResp.data.localId;
      console.log("Firebase user created:", firebaseUid);
      const hashedPassword = await bcrypt.hash(pass_key, 10);

      // Create in Users table
      const newUser = await User.create({
        email: user_name,
        password: hashedPassword,
        firebaseUid: firebaseUid,
        firebaseToken: firebaseResp.data.idToken
      });

      // Create in People table
      const newProfile = await Person.create({
        fullName,
        mobileNumber: normalizedMobileNumber,
        email: user_name,
        dateOfBirth,
        dateOfMarriage,
        profession,
        addressForCommunication,
        profilePhoto,
        bloodGroup,
        qualification
      });

      const token = jwt.sign(
        {
          uid: newUser._id,
          email: newUser.email,
          firebase_uid: newUser.firebaseUid,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        success: true,
        message: "User registered successfully in Firebase and MongoDB",
        token,
        mongo_id: newProfile._id, // Consistent with login
        uid: firebaseUid,
        email: newUser.email,
        idToken: firebaseResp.data.idToken,
        refreshToken: firebaseResp.data.refreshToken,
        expiresIn: firebaseResp.data.expiresIn,
        profile: newProfile,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid registration request",
    });

  } catch (err) {
    console.error("Registration error:", err.response?.data || err.message);
    const errorMessage = err.response?.data?.error?.message || err.message;
    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: errorMessage,
    });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user with Username and Password (Firebase Auth + Users table verification)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Unauthorized - Invalid credentials or user not in database
 *       500:
 *         description: Server error
 */
router.post("/login", async (req, res) => {
  const { user_name, pass_key } = req.body;

  if (!user_name || !pass_key) {
    return res
      .status(400)
      .json({ success: false, message: "Username and password required" });
  }

  try {
    // 2. Verify against MongoDB Users table
    const mongoUser = await User.findOne({ email: user_name });
    if (!mongoUser) {
      return res
        .status(401)
        .json({ success: false, message: "User not found. Please register first." });
    }

    // 3. Verify against Firebase using REST API
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    
    let firebaseResp;
    try {
      firebaseResp = await axios.post(
        url,
        {
          email: user_name,
          password: pass_key,
          returnSecureToken: true,
        },
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("Firebase Login Error:", err.response?.data || err.message);
      const firebaseError = err.response?.data?.error?.message;
      
      let message = "Invalid credentials";
      if (firebaseError === "INVALID_PASSWORD") {
        message = "Incorrect password. Please try again.";
      } else if (firebaseError === "EMAIL_NOT_FOUND") {
        message = "User not found in authentication service. Please register first.";
      } else if (firebaseError === "USER_DISABLED") {
        message = "This account has been disabled.";
      }

      return res.status(401).json({
        success: false,
        message: message,
        error: firebaseError || err.message,
      });
    }

    // Update last login time
    mongoUser.lastLogin = Date.now();
    mongoUser.firebaseToken = firebaseResp.data.idToken; // Update with fresh token
    await mongoUser.save();

    // 3. Generate Custom JWT for our application
    const token = jwt.sign(
      {
        uid: mongoUser._id,
        email: mongoUser.email,
        firebase_uid: mongoUser.firebaseUid,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 4. Optionally fetch profile from People table
    let profile = await Person.findOne({ email: user_name });

    if (!profile) {
      const match = user_name.toLowerCase().match(/^([^@]+)@pran\.com$/i);
      if (match && match[1]) {
        const mobileFragment = match[1];
        profile = await Person.findOne({
          $or: [
            { mobileNumber: mobileFragment },
            { mobileNumber: { $regex: mobileFragment + "$" } }
          ]
        });
      }
    }

    return res.json({
      success: true,
      message: "Login successful (Firebase and MongoDB verified)",
      token,
      mongo_id: profile ? profile._id : null, // 🔹 Return People collection ID (used by /api/people/id/:id)
      uid: firebaseResp.data.localId,
      email: firebaseResp.data.email,
      idToken: firebaseResp.data.idToken,
      refreshToken: firebaseResp.data.refreshToken,
      expiresIn: firebaseResp.data.expiresIn,
      profile: profile || "Profile details not found in People table"
    });

  } catch (err) {
    console.error("Login error:", err.response?.data || err.message);
    const errorMessage = err.response?.data?.error?.message || err.message;
    
    return res.status(401).json({
      success: false,
      message: "Invalid username or password",
      error: errorMessage,
    });
  }
});

/**
 * @swagger
 * /api/auth/google-login:
 *   post:
 *     summary: Login user using Google ID Token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthGoogleTokenRequest'
 *     responses:
 *       200:
 *         description: Google login successful
 *       401:
 *         description: User not registered
 *       500:
 *         description: Server error
 */
router.post("/google-login", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res
      .status(400)
      .json({ success: false, message: "ID token required" });
  }

  try {
    // 1️⃣ Verify ID token via Firebase REST API
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
    console.log("Verifying Google token...");
    // Updated to the correct v1 endpoint for verifying ID tokens
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
    
    let verifyResp;
    try {
      verifyResp = await axios.post(verifyUrl, { idToken });
    } catch (axiosErr) {
      console.error("Firebase Token Verification Error:", axiosErr.response?.data || axiosErr.message);
      
      // If the v1 lookup fails, try the older v3 getAccountInfo pattern as a fallback
      try {
        console.log("Retrying with v3 endpoint...");
        const v3Url = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${FIREBASE_API_KEY}`;
        verifyResp = await axios.post(v3Url, { idToken });
      } catch (v3Err) {
        console.error("Firebase v3 Verification Error:", v3Err.response?.data || v3Err.message);
        return res.status(401).json({
          success: false,
          message: "Invalid Google token",
          error: v3Err.response?.data?.error?.message || v3Err.message
        });
      }
    }

    if (!verifyResp || !verifyResp.data || !verifyResp.data.users || !verifyResp.data.users[0]) {
      console.error("Firebase response missing user data:", verifyResp?.data);
      return res.status(401).json({
        success: false,
        message: "Failed to retrieve user info from Google token"
      });
    }

    const userInfo = verifyResp.data.users[0];
    if (!userInfo) {
      return res.status(401).json({ success: false, message: "User info not found in token" });
    }
    const email = userInfo.email;
    const firebaseUid = userInfo.localId;
    console.log("Google user verified:", email);

    // 2️⃣ Check if user exists in MongoDB
    const mongoUser = await User.findOne({ email });

    if (!mongoUser) {
      console.log(`User ${email} not found in MongoDB. Deleting from Firebase for strict security...`);
      // 🚨 Strict Security: Delete from Firebase if not in our MongoDB
      try {
        await admin.auth().deleteUser(firebaseUid);
        console.log(`Successfully deleted ${email} from Firebase.`);
      } catch (delErr) {
        console.error("Failed to delete unauthorized user from Firebase:", delErr.message);
      }

      return res.status(401).json({
        success: false,
        message: "Account not found in our database. Please register first.",
      });
    }

    // 3️⃣ Existing user → update last login
    try {
      mongoUser.lastLogin = Date.now();
      mongoUser.firebaseToken = idToken;
      await mongoUser.save();
    } catch (saveErr) {
      console.error("MongoDB User Save Error:", saveErr);
      return res.status(500).json({
        success: false,
        message: "Failed to update user login session",
        error: saveErr.message
      });
    }

    const token = jwt.sign(
      {
        uid: mongoUser._id,
        email: mongoUser.email,
        firebase_uid: mongoUser.firebaseUid,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 4️⃣ Fetch profile from People table
    const profile = await Person.findOne({ email });

    // ✅ Successful login
    return res.json({
      success: true,
      message: "Google login successful",
      token,
      mongo_id: profile ? profile._id : null, // 🔹 Return People collection ID
      email,
      firebase_uid: firebaseUid,
      profile: profile || null
    });
  } catch (err) {
    console.error("Google login error:", err.response?.data || err.message);
    const errorMessage = err.response?.data?.error?.message || err.message;
    return res.status(500).json({
      success: false,
      message: "Google login failed",
      error: errorMessage,
    });
  }
});

/**
 * @swagger
 * /api/auth/google-signup:
 *   post:
 *     summary: Validate Google token and return pre-filled signup data
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthGoogleTokenRequest'
 *     responses:
 *       200:
 *         description: Token valid; returns Google profile info or existence flag
 *       401:
 *         description: Invalid token
 */
router.post("/google-signup", async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res
      .status(400)
      .json({ success: false, message: "ID token required" });
  }

  try {
    // 1️⃣ Verify token using Firebase REST API
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
    console.log("Verifying Google token for signup...");
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
    
    let response;
    try {
      response = await axios.post(verifyUrl, { idToken });
    } catch (axiosErr) {
      console.error("Firebase Token Verification Error (Signup):", axiosErr.response?.data || axiosErr.message);
      
      // Fallback to v3 if v1 fails
      try {
        console.log("Retrying signup verification with v3 endpoint...");
        const v3Url = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${FIREBASE_API_KEY}`;
        response = await axios.post(v3Url, { idToken });
      } catch (v3Err) {
        console.error("Firebase signup v3 Verification Error:", v3Err.response?.data || v3Err.message);
        return res.status(401).json({
          success: false,
          message: "Invalid Google token",
          error: v3Err.response?.data?.error?.message || v3Err.message
        });
      }
    }

    if (!response || !response.data || !response.data.users || !response.data.users[0]) {
      console.error("Firebase signup response missing user data:", response?.data);
      return res.status(401).json({
        success: false,
        message: "Failed to retrieve user info from Google token"
      });
    }

    const user = response.data.users[0];
    if (!user) {
      return res.status(401).json({ success: false, message: "User info not found in token" });
    }
    const { localId: firebase_uid, email, displayName } = user;
    console.log("Google user verified for signup:", email);

    // 2️⃣ Extract first and last name safely
    let first_name = "";
    let last_name = "";

    if (displayName && displayName.trim()) {
      const nameParts = displayName.trim().split(/\s+/);
      if (nameParts.length === 1) {
        first_name = nameParts[0];
        last_name = "";
      } else {
        first_name = nameParts[0];
        last_name = nameParts.slice(1).join(" ");
      }
    } else {
      first_name = email.split("@")[0];
      last_name = "";
    }

    // 3️⃣ Check if user already exists in MongoDB
    const existingUser = await User.findOne({ $or: [{ firebaseUid: firebase_uid }, { email: email }] });

    if (existingUser) {
      return res.status(200).json({
        success: false,
        exists: true,
        message: "User already registered. Please login instead.",
      });
    }

    // 🚀 NEW: Pre-approval check
    // If the user isn't in the People table (pre-approved), delete from Firebase
    const preApproved = await Person.findOne({ email });
    if (!preApproved) {
      console.log(`Email ${email} not found in People table. Deleting from Firebase for strict security...`);
      try {
        await admin.auth().deleteUser(firebase_uid);
      } catch (delErr) {
        console.error("Firebase cleanup failed:", delErr.message);
      }
      return res.status(401).json({
        success: false,
        message: "Your email is not authorized to register. Please contact support or use an authorized email."
      });
    }

    // 4️⃣ Return Google user data for prefill
    return res.status(200).json({
      success: true,
      exists: false,
      googleData: {
        firebase_uid,
        email,
        username: displayName || email.split("@")[0],
        first_name,
        last_name,
      },
      message: "Google user verified, please complete signup.",
    });
  } catch (err) {
    console.error("Google signup error:", err.response?.data || err.message);
    const errorMessage = err.response?.data?.error?.message || err.message;
    return res.status(401).json({
      success: false,
      message: "Invalid Google token or verification failed.",
      error: errorMessage,
    });
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send password reset email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *     responses:
 *       200:
 *         description: Reset email sent
 *       400:
 *         description: Email is required
 *       404:
 *         description: User not found in database
 *       500:
 *         description: Failed to send reset email
 */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    // 1. Verify user exists in MongoDB first
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found. Please register first." });
    }

    // 2. Request Firebase to send reset email
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`;

    await axios.post(url, {
      requestType: "PASSWORD_RESET",
      email: email
    });

    return res.status(200).json({
      success: true,
      message: "Password reset email sent successfully. Please check your inbox."
    });
  } catch (err) {
    console.error("Forgot Password Error:", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send reset email",
      error: err.response?.data?.error?.message || err.message
    });
  }
});

/**
 * @swagger
 * /api/auth/update-password:
 *   post:
 *     summary: Update password using oobCode from email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - newPassword
 *               - oobCode
 *             properties:
 *               email:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               oobCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Failed to update password
 */
router.post("/update-password", async (req, res) => {
  const { email, newPassword, oobCode } = req.body;

  if (!email || !newPassword || !oobCode) {
    return res.status(400).json({
      success: false,
      message: "Email, new password, and oobCode are required.",
    });
  }

  try {
    // 1️⃣ Update password in Firebase using resetPassword endpoint
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
    const firebaseUrl = `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${FIREBASE_API_KEY}`;
    
    await axios.post(firebaseUrl, { 
      oobCode, 
      newPassword 
    });

    // 2️⃣ Hash new password for MongoDB
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3️⃣ Update MongoDB Users collection
    const updatedUser = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found in database to update password."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password updated successfully in Firebase and MongoDB.",
    });
  } catch (err) {
    console.error("Error updating password:", err.response?.data || err.message);
    const firebaseError = err.response?.data?.error?.message;
    
    let message = "Failed to update password.";
    if (firebaseError === "EXPIRED_OOB_CODE") {
      message = "The reset link has expired. Please request a new one.";
    } else if (firebaseError === "INVALID_OOB_CODE") {
      message = "Invalid reset link. Please try again.";
    } else if (firebaseError === "USER_DISABLED") {
      message = "This account has been disabled.";
    }

    return res.status(500).json({ 
      success: false, 
      message,
      error: firebaseError || err.message 
    });
  }
});

module.exports = router;
