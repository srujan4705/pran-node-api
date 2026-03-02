const express = require('express');
const router = express.Router();
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const DailyBlog = require('../models/DailyBlog');

const upload = multer({ storage: multer.memoryStorage() });

const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const azureBlogContainerName = process.env.AZURE_BLOG_IMAGES_CONTAINER;

let blogImagesContainerClient = null;

if (azureConnectionString && azureBlogContainerName) {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString);
    blogImagesContainerClient = blobServiceClient.getContainerClient(azureBlogContainerName);
  } catch (err) {
    blogImagesContainerClient = null;
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     DailyBlog:
 *       type: object
 *       required:
 *         - email
 *         - name
 *         - description
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated ID
 *         email:
 *           type: string
 *           example: "user@gmail.com"
 *         name:
 *           type: string
 *           example: "User Name"
 *         description:
 *           type: string
 *           example: "This is a daily blog post content..."
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"]
 *         postDate:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/blogs:
 *   get:
 *     summary: Get all daily blogs
 *     tags: [Daily Blogs]
 *     responses:
 *       200:
 *         description: List of all blogs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DailyBlog'
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res) => {
  try {
    const blogs = await DailyBlog.find().sort({ postDate: -1 });
    res.status(200).json({ success: true, data: blogs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @swagger
 * /api/blogs/upload-images:
 *   post:
 *     summary: Upload one or more blog images to Azure Blob Storage
 *     tags: [Daily Blogs]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *       400:
 *         description: Invalid data or upload failed
 *       500:
 *         description: Azure storage not configured
 */
router.post("/upload-images", upload.array("images"), async (req, res) => {
  try {
    if (!blogImagesContainerClient) {
      return res.status(500).json({
        success: false,
        message: "Azure storage for blog images is not configured"
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded. Use field name 'images'."
      });
    }

    const urls = [];

    for (const file of req.files) {
      const originalName = file.originalname || "blog-image";
      const extension = originalName.includes(".") ? originalName.substring(originalName.lastIndexOf(".")) : "";
      const blobName = `blog-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;

      const blockBlobClient = blogImagesContainerClient.getBlockBlobClient(blobName);

      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype }
      });

      urls.push(blockBlobClient.url);
    }

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      urls
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "Blog image upload failed",
      error: err.message
    });
  }
});

/**
 * @swagger
 * /api/blogs/user/{email}:
 *   get:
 *     summary: Get all blogs posted by a specific user email
 *     tags: [Daily Blogs]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         example: "user@gmail.com"
 *     responses:
 *       200:
 *         description: List of blogs for the user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DailyBlog'
 *       500:
 *         description: Server error
 */
router.get("/user/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const blogs = await DailyBlog.find({ email }).sort({ postDate: -1 });
    res.status(200).json({
      success: true,
      count: blogs.length,
      data: blogs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @swagger
 * /api/blogs:
 *   post:
 *     summary: Create a new daily blog
 *     tags: [Daily Blogs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DailyBlog'
 *     responses:
 *       201:
 *         description: Blog created successfully
 *       400:
 *         description: Invalid input
 */
router.post("/", async (req, res) => {
  try {
    const newBlog = new DailyBlog(req.body);
    const savedBlog = await newBlog.save();
    res.status(201).json({ success: true, message: "Blog created", data: savedBlog });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * @swagger
 * /api/blogs/{id}:
 *   put:
 *     summary: Update a blog by ID
 *     tags: [Daily Blogs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DailyBlog'
 *     responses:
 *       200:
 *         description: Blog updated
 *       404:
 *         description: Blog not found
 */
router.put("/:id", async (req, res) => {
  try {
    const updatedBlog = await DailyBlog.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updatedBlog) return res.status(404).json({ success: false, message: "Blog not found" });
    res.status(200).json({ success: true, message: "Blog updated", data: updatedBlog });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * @swagger
 * /api/blogs/{id}:
 *   delete:
 *     summary: Delete a blog by ID
 *     tags: [Daily Blogs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Blog deleted
 *       404:
 *         description: Blog not found
 */
router.delete("/:id", async (req, res) => {
  try {
    const deletedBlog = await DailyBlog.findByIdAndDelete(req.params.id);
    if (!deletedBlog) return res.status(404).json({ success: false, message: "Blog not found" });
    res.status(200).json({ success: true, message: "Blog deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
