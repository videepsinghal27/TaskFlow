const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Email Config
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "your-email@gmail.com",  // Replace with your email
        pass: "your-password"  // Replace with your email password or App Password
    }
});

app.post("/send-report", (req, res) => {
    const { email, report } = req.body;

    const mailOptions = {
        from: "your-email@gmail.com",
        to: email,
        subject: "Your Task Report",
        text: report
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("❌ Email failed:", error);
            res.status(500).send("Email failed");
        } else {
            console.log("✅ Email sent:", info.response);
            res.send("Email sent successfully");
        }
    });
});

// Start Server
app.listen(5000, () => console.log("Server running on port 5000"));
