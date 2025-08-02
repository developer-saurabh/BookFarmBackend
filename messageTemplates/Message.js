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
  })
};
