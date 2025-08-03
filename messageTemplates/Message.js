exports.messages = {
  // 🔹 Generic OTP Email (used for admin registration or login OTP)
  otp: (data) => ({
    subject: "Your Admin Panel OTP Code",
    html: `
      <h2>OTP Verification</h2>
      <p>Your OTP code is: <b style="font-size:20px;">${data.otp}</b></p>
      <p>This code is valid for 5 minutes. Do not share it with anyone.</p>
    `
  }),

  // 🔹 Forgot Password OTP Email (specific for password reset)
  forgotPasswordOtp: (data) => ({
    subject: "Password Reset Request – Book My Farm ",
    html: `
      <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333;">Password Reset OTP</h2>
          <p>Hello Admin,</p>
          <p>We received a request to reset your password. Please use the OTP below to proceed:</p>
          <h3 style="background: #27ae60; color: white; display: inline-block; padding: 10px 20px; border-radius: 5px;">${data.otp}</h3>
          <p>This OTP is valid for <b>2 minutes</b>. If you did not request a password reset, please ignore this email.</p>
          <p>Thanks,<br><b>Healthy Wrinkles Admin Panel</b></p>
        </div>
      </div>
    `
  }),
    vendorRegistrationOtp: (data) => ({
    subject: "Verify Your Email - Book My Farm Vendor Registration",
    html: `
      <div style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50;">Vendor Email Verification</h2>
          <p>Hello <b>${data.name}</b>,</p>
          <p>Thank you for registering on <b>Book My Farm</b>. Please use the OTP below to verify your email:</p>
          <h3 style="background: #27ae60; color: white; display: inline-block; padding: 10px 20px; border-radius: 5px;">${data.otp}</h3>
          <p>This OTP is valid for <b>10 minutes</b>. Please do not share it with anyone.</p>
          <hr style="border:0; border-top:1px solid #ddd; margin:20px 0;" />
          <p style="color:#7f8c8d;">If you didn’t initiate this request, please ignore this email.</p>
          <p>Regards,<br><b>Book My Farm Team</b></p>
        </div>
      </div>
    `
  }),
};
