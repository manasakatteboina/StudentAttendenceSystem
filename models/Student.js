
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  rollNumber: {
    type: String,
    required: true
  },
  classId: {
    type: String,
    required: true
  },
  parentName: {
    type: String,
    required: true
  },
  parentPhone: {
    type: String,
    required: true
  },
  parentEmail: {
    type: String,
    default: ""
  }
});

module.exports = mongoose.model("Student", studentSchema);
