
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const Student = require("./models/Student");
const Attendance = require("./models/Attendance");
const Faculty = require("./models/Faculty");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Email configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Health check
app.get("/test", (req, res) => {
  res.json({
    message: "AttendEase server is running!",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  });
});

// Faculty registration
app.post("/register", async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({
        message: "Name, username, and password are required.",
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must contain at least 6 characters.",
      });
    }

    const existingFaculty = await Faculty.findOne({
      username: cleanUsername,
    });

    if (existingFaculty) {
      return res.status(409).json({
        message: "This username is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const faculty = await Faculty.create({
      name: name.trim(),
      username: cleanUsername,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Faculty registered successfully.",
      faculty: {
        id: faculty._id,
        name: faculty.name,
        username: faculty.username,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "This username is already registered.",
      });
    }

    return res.status(500).json({
      message: "Registration failed.",
    });
  }
});

// Faculty login
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required.",
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET is missing from environment variables.");

      return res.status(500).json({
        message: "Login configuration is missing.",
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    const faculty = await Faculty.findOne({
      username: cleanUsername,
    });

    if (!faculty) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const passwordMatched = await bcrypt.compare(
      password,
      faculty.password
    );

    if (!passwordMatched) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const token = jwt.sign(
      {
        facultyId: faculty._id.toString(),
        username: faculty.username,
      },
      jwtSecret,
      { expiresIn: "1h" }
    );

    return res.json({
      message: "Login successful.",
      token,
      faculty: {
        id: faculty._id,
        name: faculty.name,
        username: faculty.username,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Login failed.",
    });
  }
});

// Add a student
app.post("/students", async (req, res) => {
  try {
    const {
      name,
      rollNumber,
      classId,
      parentName,
      parentPhone,
      parentEmail,
    } = req.body;

    if (!name || !rollNumber || !classId) {
      return res.status(400).json({
        message: "Name, roll number, and class are required.",
      });
    }

    const student = await Student.create({
      name: name.trim(),
      rollNumber: rollNumber.trim(),
      classId,
      parentName,
      parentPhone,
      parentEmail: parentEmail
        ? parentEmail.trim().toLowerCase()
        : undefined,
    });

    return res.status(201).json({
      message: "Student added successfully.",
      student,
    });
  } catch (error) {
    console.error("Add student error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "A student with this roll number already exists.",
      });
    }

    return res.status(500).json({
      message: "Could not add student.",
      error: error.message,
    });
  }
});

// Get all students
app.get("/students", async (req, res) => {
  try {
    const students = await Student.find().sort({ rollNumber: 1 });
    return res.json(students);
  } catch (error) {
    console.error("Fetch students error:", error);

    return res.status(500).json({
      message: "Could not fetch students.",
    });
  }
});

// Update a student
app.put("/students/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid student ID.",
      });
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({
        message: "Student not found.",
      });
    }

    return res.json({
      message: "Student updated successfully.",
      student,
    });
  } catch (error) {
    console.error("Update student error:", error);

    return res.status(500).json({
      message: "Could not update student.",
      error: error.message,
    });
  }
});

// Delete a student and their attendance records
app.delete("/students/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid student ID.",
      });
    }

    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found.",
      });
    }

    await Attendance.deleteMany({ studentId: student._id });

    return res.json({
      message: "Student and related attendance records deleted.",
    });
  } catch (error) {
    console.error("Delete student error:", error);

    return res.status(500).json({
      message: "Could not delete student.",
    });
  }
});

// Mark or update attendance
app.post("/attendance", async (req, res) => {
  try {
    const { studentId, date, status, markedBy } = req.body;

    if (!studentId || !date || !status || !markedBy) {
      return res.status(400).json({
        message: "Student ID, date, status, and markedBy are required.",
      });
    }

    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({
        message: "Invalid student ID.",
      });
    }

    if (!["Present", "Absent"].includes(status)) {
      return res.status(400).json({
        message: "Status must be Present or Absent.",
      });
    }

    const attendanceDate = new Date(date);

    if (Number.isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        message: "Please provide a valid attendance date.",
      });
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        message: "Student not found.",
      });
    }

    const attendance = await Attendance.findOneAndUpdate(
      {
        studentId: student._id,
        date: attendanceDate,
      },
      {
        $set: {
          status,
          markedBy,
        },
        $setOnInsert: {
          studentId: student._id,
          date: attendanceDate,
          notificationStatus: "Not Sent",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // Send a parent notification when a student is marked absent.
    if (
      status === "Absent" &&
      student.parentEmail &&
      process.env.GMAIL_USER &&
      process.env.GMAIL_APP_PASSWORD
    ) {
      try {
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: student.parentEmail,
          subject: "Student Attendance Notification",
          text:
            `Dear ${student.parentName || "Parent/Guardian"},\n\n` +
            `This is to inform you that ${student.name} ` +
            `(Roll Number: ${student.rollNumber}) was marked absent ` +
            `on ${attendanceDate.toLocaleDateString("en-IN")}.\n\n` +
            "Please contact the faculty if you have any questions.\n\n" +
            "Regards,\nAttendEase",
        });

        attendance.notificationStatus = "Sent";
        await attendance.save();
      } catch (emailError) {
        console.error("Parent notification failed:", emailError);
        attendance.notificationStatus = "Failed";
        await attendance.save();
      }
    }

    return res.json({
      message: "Attendance saved successfully.",
      attendance,
    });
  } catch (error) {
    console.error("Mark attendance error:", error);

    return res.status(500).json({
      message: "Could not save attendance.",
      error: error.message,
    });
  }
});

// Get attendance records
app.get("/attendance", async (req, res) => {
  try {
    const filter = {};

    if (req.query.studentId) {
      if (!mongoose.isValidObjectId(req.query.studentId)) {
        return res.status(400).json({
          message: "Invalid student ID.",
        });
      }

      filter.studentId = req.query.studentId;
    }

    if (req.query.date) {
      const attendanceDate = new Date(req.query.date);

      if (Number.isNaN(attendanceDate.getTime())) {
        return res.status(400).json({
          message: "Invalid date.",
        });
      }

      filter.date = attendanceDate;
    }

    if (req.query.status) {
      if (!["Present", "Absent"].includes(req.query.status)) {
        return res.status(400).json({
          message: "Status must be Present or Absent.",
        });
      }

      filter.status = req.query.status;
    }

    const records = await Attendance.find(filter)
      .populate("studentId")
      .sort({ date: -1 });

    return res.json(records);
  } catch (error) {
    console.error("Fetch attendance error:", error);

    return res.status(500).json({
      message: "Could not fetch attendance records.",
    });
  }
});

// Start server after connecting to MongoDB
async function startServer() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is missing from environment variables.");
    }

    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully!");

    console.log(
      "Gmail configuration:",
      process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
        ? "Found"
        : "Missing"
    );

    console.log(
      "JWT configuration:",
      process.env.JWT_SECRET ? "Found" : "Missing"
    );

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
