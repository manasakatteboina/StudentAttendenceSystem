const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: [true, "Student ID is required."],
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: [true, "Student name is required."],
      trim: true,
    },

    rollNumber: {
      type: String,
      required: [true, "Roll number is required."],
      trim: true,
    },

    classId: {
      type: String,
      required: [true, "Class is required."],
      trim: true,
    },

    parentName: {
      type: String,
      required: [true, "Parent name is required."],
      trim: true,
    },

    parentPhone: {
      type: String,
      required: [true, "Parent phone is required."],
      trim: true,
    },

    parentEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Student", studentSchema);