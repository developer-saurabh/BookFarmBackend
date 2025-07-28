const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendEmail = async (to, subject, html) => {
  try {
    if (!to || !subject || !html) {
      throw new Error("Missing required email parameters (to, subject, html)");
    }

    const info = await transporter.sendMail({
      from: `<${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });

    console.log(` Email sent successfully to ${to} | MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };

  } catch (err) {
    console.error(" Email sending failed:", err);
    return { success: false, error: err.message };
  }
};
