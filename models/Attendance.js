
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true
    },
    date: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["Present", "Absent"],
        required: true
    },
    markedBy: {
        type: String,
        required: true
    },
    notificationStatus: {
        type: String,
        enum: [
            "Not required",
            "Pending",
            "Sent",
            "Failed",
            "Demo"
        ],
        default: "Not required"
    }
});

// Prevent duplicate attendance for the same student and date
attendanceSchema.index(
    { studentId: 1, date: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "Attendance",
    attendanceSchema
);
