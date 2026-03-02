const express = require("express");
const router = express.Router();
const multer = require("multer");
const { BlobServiceClient } = require("@azure/storage-blob");
const Person = require("../models/Person");
const User = require("../models/User");
const admin = require("../config/firebase");

const upload = multer({ storage: multer.memoryStorage() });

const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const azureContainerName = process.env.AZURE_PROFILE_PHOTOS_CONTAINER;

let containerClient = null;

if (azureConnectionString && azureContainerName) {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString);
    containerClient = blobServiceClient.getContainerClient(azureContainerName);
  } catch (err) {
    containerClient = null;
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Person:
 *       type: object
 *       required:
 *         - fullName
 *         - mobileNumber
 *         - email
 *         - profession
 *         - addressForCommunication
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated ID of the person
 *         fullName:
 *           type: string
 *         mobileNumber:
 *           type: string
 *         email:
 *           type: string
 *         dateOfBirth:
 *           type: string
 *         dateOfMarriage:
 *           type: string
 *         profession:
 *           type: object
 *           properties:
 *             title:
 *               type: string
 *             description:
 *               type: string
 *         addressForCommunication:
 *           type: object
 *           properties:
 *             street1:
 *               type: string
 *             street2:
 *               type: string
 *             city:
 *               type: string
 *             district:
 *               type: string
 *             state:
 *               type: string
 *             country:
 *               type: string
 *         profilePhoto:
 *           type: string
 *           description: URL of the profile photo
 *         bloodGroup:
 *           type: string
 *         qualification:
 *           type: string
 */

/**
 * @swagger
 * /api/people:
 *   get:
 *     summary: Returns the list of all people
 *     tags: [People]
 *     responses:
 *       200:
 *         description: The list of people
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Person'
 */
router.get("/", async (req, res) => {
  try {
    const people = await Person.find();
    res.status(200).json({
      success: true,
      count: people.length,
      data: people
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * @swagger
 * /api/people/search:
 *   get:
 *     summary: Search people by name or profession
 *     tags: [People]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Name or profession to search for
 *     responses:
 *       200:
 *         description: The list of people matching the search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Person'
 */
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ success: false, message: "Please provide a search query" });
    }

    const searchCriteria = {
      $or: [
        { fullName: { $regex: query, $options: "i" } },
        { "profession.title": { $regex: query, $options: "i" } }
      ]
    };

    const people = await Person.find(searchCriteria);

    res.status(200).json({
      success: true,
      count: people.length,
      data: people
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Search failed", error: err.message });
  }
});

/**
 * @swagger
 * /api/people/id/{id}:
 *   get:
 *     summary: Get a person by ID
 *     tags: [People]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The person ID
 *     responses:
 *       200:
 *         description: The person data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Person'
 *       404:
 *         description: Person not found
 *       400:
 *         description: Invalid ID
 */
router.get("/id/:id", async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found"
      });
    }

    res.status(200).json({ success: true, data: person });
  } catch (err) {
    res.status(400).json({ success: false, message: "Invalid ID" });
  }
});

/**
 * @swagger
 * /api/people:
 *   post:
 *     summary: Create a new person
 *     tags: [People]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Person'
 *     responses:
 *       201:
 *         description: Person created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Person'
 *       400:
 *         description: Invalid data
 */
router.post("/", async (req, res) => {
  try {
    const person = await Person.create(req.body);
    res.status(201).json({
      success: true,
      message: "Person created",
      data: person
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Invalid data",
      error: err.message
    });
  }
});

/**
 * @swagger
 * /api/people/id/{id}:
 *   put:
 *     summary: Update a person by ID
 *     tags: [People]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The person ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Person'
 *     responses:
 *       200:
 *         description: Person updated successfully
 *       404:
 *         description: Person not found
 *       400:
 *         description: Update failed
 */
router.put("/id/:id", async (req, res) => {
  try {
    // 🔹 Perform a partial update (Patch-like behavior)
    // Using { new: true, runValidators: true } ensures we get the updated document and validate changes
    const person = await Person.findByIdAndUpdate(
      req.params.id,
      { $set: req.body }, // Use $set to allow updating only provided fields
      { new: true, runValidators: true }
    );

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Person updated successfully",
      data: person
    });
  } catch (err) {
    console.error("Update error:", err.message);
    res.status(400).json({ 
      success: false, 
      message: "Update failed", 
      error: err.message 
    });
  }
});

/**
 * @swagger
 * /api/people/id/{id}:
 *   delete:
 *     summary: Delete a person by ID
 *     tags: [People]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The person ID
 *     responses:
 *       200:
 *         description: User deleted successfully from People, Users, and Firebase
 *       404:
 *         description: User not found in People collection
 *       500:
 *         description: Delete failed or Firebase error
 */
router.delete("/id/:id", async (req, res) => {
  try {
    const personId = req.params.id;

    // 1️⃣ Find the person in the People collection first to get the email
    const person = await Person.findById(personId);
    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found in People collection"
      });
    }

    const email = person.email;

    // 2️⃣ Find and delete from Users collection to get the Firebase UID
    const user = await User.findOne({ email });
    let firebaseUid = null;
    if (user) {
      firebaseUid = user.firebaseUid;
      await User.findByIdAndDelete(user._id);
      console.log(`Deleted user ${email} from Users collection`);
    }

    // 3️⃣ Delete from Firebase if UID exists
    if (firebaseUid) {
      try {
        await admin.auth().deleteUser(firebaseUid);
        console.log(`Deleted user ${firebaseUid} from Firebase`);
      } catch (fbError) {
        console.error("Firebase delete error:", fbError.message);
        // Note: We continue even if Firebase delete fails (e.g., user already deleted in FB)
      }
    }

    // 4️⃣ Finally delete from People collection
    await Person.findByIdAndDelete(personId);
    console.log(`Deleted person ${personId} from People collection`);

    res.status(200).json({
      success: true,
      message: "User data completely removed from People, Users, and Firebase",
      details: {
        email,
        firebaseDeleted: !!firebaseUid,
        usersTableDeleted: !!user
      }
    });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({ 
      success: false, 
      message: "Delete failed", 
      error: err.message 
    });
  }
});

/**
 * @swagger
 * /api/people/id/{id}/profile-photo:
 *   post:
 *     summary: Upload or replace a person's profile photo
 *     tags: [People]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The person ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile photo uploaded successfully
 *       400:
 *         description: Invalid data or upload failed
 *       404:
 *         description: Person not found
 */
router.post("/id/:id/profile-photo", upload.single("photo"), async (req, res) => {
  try {
    if (!containerClient) {
      return res.status(500).json({
        success: false,
        message: "Azure storage is not configured"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Use field name 'photo'."
      });
    }

    const person = await Person.findById(req.params.id);

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found"
      });
    }

    const originalName = req.file.originalname || "profile-photo";
    const extension = originalName.includes(".") ? originalName.substring(originalName.lastIndexOf(".")) : "";
    const blobName = `${person._id}-${Date.now()}${extension}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype }
    });

    const photoUrl = blockBlobClient.url;

    person.profilePhoto = photoUrl;
    await person.save();

    res.status(200).json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: {
        id: person._id,
        profilePhoto: photoUrl
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Profile photo upload failed",
      error: err.message
    });
  }
});

module.exports = router;
