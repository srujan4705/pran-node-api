const mongoose = require('mongoose');

const dailyBlogSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  images: {
    type: [String],
    default: []
  },
  postDate: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'Daily_Blogs' // Explicitly set collection name
});

module.exports = mongoose.model('DailyBlog', dailyBlogSchema);
