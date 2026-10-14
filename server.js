
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");

const Student = require("./models/Student");
const Attendance = require("./models/Attendance");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Gmail transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// Home route
app.get("/", (req, res) => {
    res.send("Student Attendance System Backend is Running!");
});

// Test server and database
app.get("/test", (req, res) => {
    res.json({
        message: "Backend is working successfully!",
        mongodb:
            mongoose.connection.readyState === 1
                ? "Connected"
                : "Disconnected",
        notifications: "Gmail notifications enabled"
    });
});

// Add student
app.post("/students", async (req, res) => {
    try {
        const student = new Student(req.body);
        const savedStudent = await student.save();

        res.status(201).json({
            message: "Student added successfully!",
            student: savedStudent
        });
    } catch (error) {
        console.error("Add student error:", error.message);

        res.status(error.code === 11000 ? 409 : 400).json({
            message: "Could not add student.",
            error: error.message
        });
    }
});

// Get all students
app.get("/students", async (req, res) => {
    try {
        const students = await Student.find().sort({ rollNumber: 1 });
        res.json(students);
    } catch (error) {
        res.status(500).json({
            message: "Could not fetch students.",
            error: error.message
        });
    }
});

// Update student
app.put("/students/:studentId", async (req, res) => {
    try {
        const {
            name,
            rollNumber,
            classId,
            parentName,
            parentPhone,
            parentEmail
        } = req.body;

        if (
            !name ||
            !rollNumber ||
            !classId ||
            !parentName ||
            !parentPhone
        ) {
            return res.status(400).json({
                message: "Name, roll number, class, parent name and parent phone are required."
            });
        }

        const updatedStudent = await Student.findOneAndUpdate(
            { studentId: req.params.studentId },
            {
                $set: {
                    name,
                    rollNumber,
                    classId,
                    parentName,
                    parentPhone,
                    parentEmail: parentEmail || ""
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!updatedStudent) {
            return res.status(404).json({
                message: "Student not found."
            });
        }

        res.json({
            message: "Student updated successfully!",
            student: updatedStudent
        });
    } catch (error) {
        console.error("Update student error:", error.message);

        res.status(400).json({
            message: "Could not update student.",
            error: error.message
        });
    }
});

// DELETE student and attendance records
app.delete("/students/:studentId", async (req, res) => {
    try {
        const student = await Student.findOne({
            studentId: req.params.studentId
        });

        if (!student) {
            return res.status(404).json({
                message: "Student not found."
            });
        }

        // Remove the student's attendance history first
        await Attendance.deleteMany({
            studentId: student.studentId
        });

        // Remove the student
        await Student.deleteOne({
            studentId: student.studentId
        });

        res.json({
            message: "Student and associated attendance records deleted successfully!",
            studentId: student.studentId
        });
    } catch (error) {
        console.error("Delete student error:", error.message);

        res.status(500).json({
            message: "Could not delete student.",
            error: error.message
        });
    }
});

// Mark attendance and send parent email for absence
app.post("/attendance", async (req, res) => {
    try {
        const { studentId, date, status, markedBy } = req.body;

        if (!studentId || !date || !status || !markedBy) {
            return res.status(400).json({
                message: "studentId, date, status and markedBy are required."
            });
        }

        if (!["Present", "Absent"].includes(status)) {
            return res.status(400).json({
                message: "Status must be Present or Absent."
            });
        }

        if (
            typeof date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date)
        ) {
            return res.status(400).json({
                message: "Date must use YYYY-MM-DD format."
            });
        }

        const parsedDate = new Date(`${date}T00:00:00.000Z`);

        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== date
        ) {
            return res.status(400).json({
                message: "Please provide a valid date."
            });
        }

        const student = await Student.findOne({ studentId });

        if (!student) {
            return res.status(404).json({
                message: "Student not found."
            });
        }

        const previous = await Attendance.findOne({
            studentId,
            date
        });

        const alreadySent =
            previous &&
            previous.status === "Absent" &&
            previous.notificationStatus === "Sent";

        // Save or update attendance
        const record = await Attendance.findOneAndUpdate(
            { studentId, date },
            {
                $set: {
                    studentId,
                    date,
                    status,
                    markedBy,
                    notificationStatus:
                        status === "Absent" ? "Pending" : "Not required"
                }
            },
            {
                returnDocument: "after",
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        if (status === "Present") {
            return res.json({
                message: "Attendance marked Present successfully.",
                attendance: record,
                email: { status: "Not required" }
            });
        }

        // Don't resend an email already sent for this absence
        if (alreadySent) {
            return res.json({
                message: "Attendance saved. Parent was already notified.",
                attendance: record,
                email: {
                    status: "Sent",
                    message: "Duplicate email skipped."
                }
            });
        }

        const parentEmail = (student.parentEmail || "").trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
            record.notificationStatus = "Failed";
            await record.save();

            return res.status(400).json({
                message: "Attendance saved, but the parent email is missing or invalid.",
                attendance: record,
                email: { status: "Failed" }
            });
        }

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            record.notificationStatus = "Failed";
            await record.save();

            return res.status(500).json({
                message: "Gmail configuration is missing from .env.",
                attendance: record,
                email: { status: "Failed" }
            });
        }

        try {
            await transporter.sendMail({
                from: `"Student Attendance System" <${process.env.GMAIL_USER}>`,
                to: parentEmail,
                subject: "Student Attendance Alert",
                text:
                    `Dear ${student.parentName},\n\n` +
                    `Your child ${student.name} (Roll No. ${student.rollNumber}) ` +
                    `was marked ABSENT on ${date}.\n\n` +
                    "Please contact the college if you need further information.\n\n" +
                    "Regards,\nStudent Attendance System"
            });

            record.notificationStatus = "Sent";
            await record.save();

            return res.json({
                message: "Attendance saved and parent email sent successfully!",
                attendance: record,
                email: {
                    status: "Sent",
                    to: parentEmail
                }
            });
        } catch (emailError) {
            console.error("Email sending failed:", emailError.message);

            record.notificationStatus = "Failed";
            await record.save();

            return res.status(502).json({
                message: "Attendance saved, but the email could not be sent.",
                attendance: record,
                email: {
                    status: "Failed",
                    message: emailError.message
                }
            });
        }
    } catch (error) {
        console.error("Attendance error:", error.message);

        res.status(500).json({
            message: "Could not complete attendance request.",
            error: error.message
        });
    }
});

// Get attendance records
app.get("/attendance", async (req, res) => {
    try {
        const records = await Attendance.find().sort({ date: -1 });
        res.json(records);
    } catch (error) {
        res.status(500).json({
            message: "Could not fetch attendance.",
            error: error.message
        });
    }
});

// Start server after connecting to MongoDB
async function startServer() {
    try {
        if (!MONGO_URI) {
            throw new Error("MONGO_URI is missing from .env");
        }

        await mongoose.connect(MONGO_URI);

        console.log("MongoDB connected successfully!");
        console.log(
            "Gmail configuration:",
            process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
                ? "Found"
                : "Missing"
        );

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
}

startServer();
