const mongoose = require("mongoose");

const personSchema = new mongoose.Schema({
  fullName: { type: String, required: false },
  mobileNumber: { type: String, required: false },
  email: { type: String, required: false },
  dateOfBirth: String,
  dateOfMarriage: String,
  profession: {
    title: { type: String, required: false },
    description: String
  },
  addressForCommunication: {
    street1: { type: String, required: false },
    street2: String,
    city: { type: String, required: false },
    district: { type: String, required: false },
    state: { type: String, required: false },
    country: { type: String, required: false }
  },
  profilePhoto: String,
  bloodGroup: String,
  qualification: String
});

module.exports = mongoose.model("Person", personSchema, "People");
