exports. messages = {
  // 🔹 OTP Email
  otp: (data) => ({
    subject: "Your Admin Panel OTP Code",
    html: `
      <h2>OTP Verification</h2>
      <p>Your OTP code is: <b style="font-size:20px;">${data.otp}</b></p>
      <p>This code is valid for 5 minutes. Do not share it with anyone.</p>
    `
  })}