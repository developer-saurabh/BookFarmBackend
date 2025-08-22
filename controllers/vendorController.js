const Vendor = require("../models/VendorModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const FarmCategory = require("../models/FarmCategory");
const Facility = require("../models/FarmFacility");
const VendorValiidation = require("../validationJoi/VendorValidation");
const FarmValidation = require("../validationJoi/FarmValidation");
// const sendAdminEmail = require('../utils/sendAdminEmail');
const Farm = require("../models/FarmModel");
const { uploadFilesToCloudinary } = require("../utils/UploadFile");
const Otp = require("../models/OtpModel");
const { sendEmail } = require("../utils/SendEmail");
const { messages } = require("../messageTemplates/Message");
const mongoose = require("mongoose");
const FarmBooking = require("../models/FarmBookingModel");
const { DateTime } = require("luxon");
const { uploadFilesToLocal } = require("../utils/UploadFileToLocal");
const Types = require("../models/TypeModel");
const FarmType = require("../models/TypeModel");
const moment = require("moment");
// Register  Apis

exports.registerVendor = async (req, res) => {
  try {
    // ✅ 1. Validate input
    const { error, value } =
      VendorValiidation.vendorRegistrationSchema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }

    // ✅ 2. Confirm password match
    if (value.password !== value.confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and Confirm Password do not match.",
      });
    }

    // ✅ 3. Check if email already exists
    const existingEmail = await Vendor.findOne({ email: value.email });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Vendor with this email already exists.",
      });
    }

    // ✅ 4. Check if phone already exists
    const existingPhone = await Vendor.findOne({ phone: value.phone });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: "Vendor with this phone number already exists.",
      });
    }

    // ✅ 5. Generate secure OTP

    // ✅ 5. Generate OTP (compatible with all Node versions)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes
    const hashedPassword = await bcrypt.hash(value.password, 10);

    // ✅ 6. Store OTP and temp vendor data
    await Otp.findOneAndUpdate(
      { email: value.email },
      {
        otp: otpCode,
        expiresAt,
        isVerified: false,
        tempVendorData: {
          name: value.name,
          email: value.email,
          phone: value.phone,
          aadhar_number: value.aadhar_number,
          password: hashedPassword,
        },
      },
      { upsert: true, new: true }
    );

    // ✅ 7. Use email template & send OTP
    const { subject, html } = messages.vendorRegistrationOtp({
      name: value.name,
      otp: otpCode,
    });
    await sendEmail(value.email, subject, html);

    // ✅ 8. Success Response
    return res.status(200).json({
      success: true,
      message:
        "OTP sent successfully to your email. Please verify to complete registration.",
      email: value.email,
      otp: otpCode,
    });
  } catch (err) {
    console.error("🚨 Error in registerVendor:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
exports.verifyVendorOtp = async (req, res) => {
  try {
    // ✅ Validate input
    const { error, value } = VendorValiidation.verifyOtpSchema.validate(
      req.body
    );
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, otp } = value;

    const otpDoc = await Otp.findOne({ email });
    if (!otpDoc)
      return res
        .status(400)
        .json({ error: "OTP not found. Please request a new one." });
    if (otpDoc.isVerified)
      return res.status(400).json({ error: "OTP already used." });
    if (otpDoc.expiresAt < new Date())
      return res
        .status(400)
        .json({ error: "OTP expired. Please request a new one." });
    if (otpDoc.otp !== otp)
      return res.status(400).json({ error: "Invalid OTP." });

    // ✅ Mark OTP as verified
    otpDoc.isVerified = true;
    await otpDoc.save();

    // ✅ Get temp vendor data
    const vendorData = otpDoc.tempVendorData;
    if (!vendorData || !vendorData.email)
      return res
        .status(400)
        .json({ error: "Vendor data missing. Please re-register." });

    // ✅ Create vendor
    const newVendor = new Vendor(vendorData);
    await newVendor.save();

    // ✅ Delete OTP doc after successful verification (cleanup)
    await Otp.deleteOne({ email });

    return res.status(201).json({
      message:
        "✅ Email verified & vendor registered successfully. Awaiting admin approval.",
      vendorId: newVendor._id,
    });
  } catch (err) {
    console.error("🚨 Error in verifyVendorOtp:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.resendVendorOtp = async (req, res) => {
  try {
    const { error, value } = VendorValiidation.resendOtpSchema.validate(
      req.body
    );
    if (error)
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });

    const { email } = value;

    // ✅ If vendor is already registered, prevent resending OTP
    const existingVendor = await Vendor.findOne({ email });
    if (existingVendor) {
      return res.status(409).json({
        success: false,
        message: "Vendor already registered with this email.",
      });
    }

    // ✅ Fetch existing OTP document
    const otpDoc = await Otp.findOne({ email });
    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "Registration not initiated. Please register first.",
      });
    }

    // ✅ Check rate limit: last OTP sent within 1 minute?
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    if (otpDoc.updatedAt > oneMinuteAgo) {
      const waitTime = Math.ceil(
        (otpDoc.updatedAt.getTime() + 60000 - Date.now()) / 1000
      );
      return res.status(429).json({
        success: false,
        message: `You can request a new OTP after ${waitTime} seconds.`,
      });
    }

    // ✅ Generate new OTP (secure fallback)
    let otpCode;
    try {
      otpCode = (parseInt(crypto.randomBytes(3).toString("hex"), 16) % 1000000)
        .toString()
        .padStart(6, "0");
    } catch (err) {
      otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // fallback
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // ✅ Update OTP while keeping tempVendorData intact
    otpDoc.otp = otpCode;
    otpDoc.expiresAt = expiresAt;
    otpDoc.isVerified = false;
    await otpDoc.save();

    // ✅ Use template for resend
    const { subject, html } = messages.vendorRegistrationOtp({
      name: otpDoc.tempVendorData?.name || "Vendor",
      otp: otpCode,
    });
    await sendEmail(email, subject, html);

    return res.status(200).json({
      success: true,
      message: "New OTP sent successfully. Please check your email.",
    });
  } catch (err) {
    console.error("🚨 Error in resendVendorOtp:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// Login apis
exports.loginVendor = async (req, res) => {
  try {
    // ✅ 1) Validate input
    const { error, value } = VendorValiidation.vendorLoginSchema.validate(
      req.body
    );
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // ✅ 2) Find vendor by email
    const vendor = await Vendor.findOne({ email: value.email });
    if (!vendor) {
      return res.status(404).json({
        error:
          "Email not found. Please register first or check your email address.",
      });
    }

    // ✅ 3) Check vendor status BEFORE comparing password
    if (!vendor.isVerified) {
      return res
        .status(403)
        .json({ error: "Vendor is not verified. Please contact admin." });
    }
    if (!vendor.isActive) {
      return res
        .status(403)
        .json({ error: "Vendor account is inactive. Please contact admin." });
    }
    if (vendor.isBlocked) {
      return res
        .status(403)
        .json({ error: "Vendor account is blocked. Access denied." });
    }

    // ✅ 4) Compare password
    const isMatch = await bcrypt.compare(value.password, vendor.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ error: "Incorrect password. Please try again." });
    }

    // ✅ 5) Update last login
    vendor.lastLogin = new Date();
    await vendor.save();

    // ✅ 6) Generate JWT with lastLogin
    const token = jwt.sign(
      {
        id: vendor._id,
        email: vendor.email,
        role: "vendor",
        lastLogin: vendor.lastLogin.getTime(),
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ 7) Send token in header
    res.setHeader("Authorization", `Bearer ${token}`);

    // ✅ 8) Response
    return res.status(200).json({
      message: "✅ Login successful.",
      token,
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
      },
    });
  } catch (err) {
    console.error("🚨 Error logging in vendor:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};

// Forgot Password

exports.forgotPasswordSendOtp = async (req, res) => {
  try {
    const { error, value } =
      VendorValiidation.forgotPasswordRequestSchema.validate(req.body, {
        abortEarly: false,
      });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    const { email } = value;

    // ✅ Check if admin exists
    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor with this email does not exist.",
      });
    }

    // ✅ Check OTP cooldown (1 minute)
    const existingOtp = await Otp.findOne({ email });
    if (existingOtp) {
      const secondsSinceLastOtp =
        (Date.now() - existingOtp.updatedAt.getTime()) / 1000;
      if (secondsSinceLastOtp < 60) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(
            60 - secondsSinceLastOtp
          )} seconds before requesting another OTP.`,
        });
      }
    }

    // ✅ Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    // ✅ Save/Update OTP with `isVerified=false`
    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, expiresAt, isVerified: false },
      { upsert: true, new: true, timestamps: true }
    );

    // ✅ Send email
    const { subject, html } = messages.forgotPasswordOtp({ otp: otpCode });
    await sendEmail(email, subject, html);

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email successfully.",
      data: { email, expiresIn: "2 minutes", otp: otpCode },
    });
  } catch (err) {
    console.error("🚨 Forgot Password Send OTP Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while sending OTP.",
      error: err.message,
    });
  }
};
exports.forgotPasswordVerifyOtp = async (req, res) => {
  try {
    const { error, value } = VendorValiidation.verifyOtpSchema.validate(
      req.body,
      { abortEarly: false }
    );
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    const { email, otp } = value;
    const otpRecord = await Otp.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "No OTP found With This Email . Please request a new one.",
      });
    }
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ email });
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one.",
      });
    }

    // ✅ Mark OTP as verified
    otpRecord.isVerified = true;
    await otpRecord.save();

    // ✅ Generate temporary reset token
    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "10m",
    });

    res.status(200).json({
      success: true,
      message:
        "OTP verified successfully. Use this token to reset your password.",
      resetToken,
    });
  } catch (err) {
    console.error("🚨 Verify OTP Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while verifying OTP.",
      error: err.message,
    });
  }
};
exports.forgotPasswordReset = async (req, res) => {
  try {
    // ✅ Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(400).json({
        success: false,
        message: "Reset token is missing in Authorization header.",
      });
    }

    const resetToken = authHeader.split(" ")[1];

    // ✅ Verify token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired reset token." });
    }

    const email = decoded.email;
    const { newPassword, confirmPassword } = req.body;

    // ✅ Check passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Confirm password does not match new password.",
      });
    }

    // ✅ Find admin
    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor account not found." });
    }

    // ✅ Prevent reusing old password
    if (await bcrypt.compare(newPassword, vendor.password)) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as old password.",
      });
    }

    // ✅ Update password
    vendor.password = await bcrypt.hash(newPassword, 10);
    await vendor.save();

    // ✅ Remove OTP record
    await Otp.deleteOne({ email });

    return res
      .status(200)
      .json({ success: true, message: "Password reset successfully." });
  } catch (err) {
    console.error("🚨 Reset Password Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: err.message,
    });
  }
};

// change Passwrd

exports.changePassword = async (req, res) => {
  try {
    // ✅ Validate request body with Joi
    const { error, value } = VendorValiidation.changePasswordSchema.validate(
      req.body,
      { abortEarly: false }
    );
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    const { oldPassword, newPassword, confirmPassword } = value;

    // ✅ Extra check (controller-level) for confirmPassword
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Confirm password does not match the new password.",
      });
    }

    // ✅ Find admin from token (ensure auth middleware sets req.admin)
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "vendor account not found.",
      });
    }

    // ✅ Verify old password
    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      vendor.password
    );
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Old password is incorrect.",
      });
    }

    // ✅ Prevent reusing old password
    const isSamePassword = await bcrypt.compare(newPassword, vendor.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as the old password.",
      });
    }

    // ✅ Hash and update password
    vendor.password = await bcrypt.hash(newPassword, 10);
    await vendor.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (err) {
    console.error("🚨 Change password error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while changing password.",
      error: err.message,
    });
  }
};

// New Updaete Major

exports.addOrUpdateFarm = async (req, res) => {
  try {
    // ✅ Parse areaImages if it's sent as a string
    if (req.body.areaImages && typeof req.body.areaImages === "string") {
      try {
        req.body.areaImages = JSON.parse(req.body.areaImages);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON format for areaImages",
        });
      }
    }

    // ✅ Do the same for address, rules, propertyDetails if needed
    ["rules", "address", "propertyDetails"].forEach((key) => {
      if (req.body[key] && typeof req.body[key] === "string") {
        try {
          req.body[key] = JSON.parse(req.body[key]);
        } catch {}
      }
    });

    const normalizeFiles = (files) => {
      if (!files) return [];
      return Array.isArray(files) ? files : [files];
    };

    // ✅ Pre-process "Types" → "types" for validation and DB
    if (req.body.Types?.length) {
      req.body.types = req.body.Types;
      delete req.body.Types;
    }

    // ✅ 1. Validate Request with Joi
    const { error, value } = VendorValiidation.farmAddValidationSchema.validate(
      req.body,
      { abortEarly: false, allowUnknown: true }
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    const ownerId = req.user.id;
    value.owner = ownerId;
    const farmId = value.farmId;

    // ✅ 2. Verify Vendor
    const vendor = await Vendor.findById(ownerId);
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found." });
    if (!vendor.isVerified || !vendor.isActive || vendor.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Vendor is not eligible to create/update farms.",
      });
    }

    // ✅ 3. Validate farmCategory if provided
    if (value.farmCategory?.length) {
      const categoryExists = await FarmCategory.find({
        _id: { $in: value.farmCategory },
      });
      if (categoryExists.length !== value.farmCategory.length) {
        return res.status(400).json({
          success: false,
          message: "One or more farmCategory IDs are invalid.",
        });
      }
    }

    // ✅ 4. Validate facilities if provided
    if (value.facilities?.length) {
      const validFacilities = await Facility.find({
        _id: { $in: value.facilities },
      });
      if (validFacilities.length !== value.facilities.length) {
        return res.status(400).json({
          success: false,
          message: "One or more facilities IDs are invalid.",
        });
      }
    }

    // ✅ 4.1 Validate and map "Types" from Postman to schema "types"
    if (value.Types?.length) {
      const incomingTypes = value.Types.filter(Boolean);

      const invalidIds = incomingTypes.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id)
      );
      if (invalidIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more type IDs are not valid ObjectIds.",
          errors: invalidIds,
        });
      }

      const found = await FarmType.find(
        { _id: { $in: incomingTypes } },
        { _id: 1 }
      ).lean();

      if (found.length !== incomingTypes.length) {
        const foundSet = new Set(found.map((t) => String(t._id)));
        const missing = incomingTypes.filter((id) => !foundSet.has(String(id)));
        return res.status(400).json({
          success: false,
          message: "One or more type IDs do not exist.",
          errors: missing,
        });
      }

      value.types = incomingTypes.map((id) => new mongoose.Types.ObjectId(id));
      delete value.Types;
    }

    // ✅ 5. Embedded Rules → Ensure Always Array
    if (value.rules) {
      if (!Array.isArray(value.rules)) {
        value.rules = [value.rules];
      }
    }

    // ✅ 6. Embedded Property Details → No DB Lookup
    if (value.propertyDetails && typeof value.propertyDetails !== "object") {
      return res.status(400).json({
        success: false,
        message: "propertyDetails must be an object.",
      });
    }

    // ✅ 7. Embedded Address → Must Be Object
    if (value.address) {
      if (typeof value.address !== "object") {
        return res
          .status(400)
          .json({ success: false, message: "Address must be an object." });
      }

      if (value.address.mapLink) {
        const urlRegex =
          /^(https?:\/\/)([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w\.-]*)*\/?$/i;
        if (!urlRegex.test(value.address.mapLink)) {
          return res.status(400).json({
            success: false,
            message: "Invalid URL format for mapLink",
          });
        }
      }

      value.location = {
        ...value.address,
        mapLink: value.address.mapLink || null,
        createdBy: req.user.id,
      };

      delete value.address;
    }

    // ✅ 8. Handle General Farm Images (main gallery) using local file upload
    if (req.files?.images || req.files?.image) {
      const imagesArray = normalizeFiles(req.files.images || req.files.image);
      if (imagesArray.length > 0) {
        let oldImages = [];

        if (farmId) {
          const existingFarm = await Farm.findOne({
            _id: farmId,
            owner: ownerId,
          });
          if (existingFarm?.images?.length) {
            oldImages = existingFarm.images;
          }
        }

        const uploadedUrls = await uploadFilesToLocal(
          imagesArray,
          "farms",
          oldImages
        );
        value.images = uploadedUrls;
      }
    }

    // ✅ 9. Handle Area-wise Images (bedroom, kitchen, etc.) using local file upload
    if (req.body.areaImages) {
      let areaImagesParsed;
      try {
        areaImagesParsed =
          typeof req.body.areaImages === "string"
            ? JSON.parse(req.body.areaImages)
            : req.body.areaImages;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON format for areaImages",
        });
      }

      const areaImagesData = [];

      for (let i = 0; i < areaImagesParsed.length; i++) {
        const area = areaImagesParsed[i];
        const fieldKey = `areaImages[${i}][images]`;

        const filesArray = normalizeFiles(req.files?.[fieldKey]);
        let uploadedUrls = [];

        let oldImagesForArea = [];
        if (farmId) {
          const existingFarm = await Farm.findOne({
            _id: farmId,
            owner: ownerId,
          });
          const matchingArea = existingFarm?.areaImages?.find(
            (ai) => ai.areaType === area.areaType
          );
          if (matchingArea?.images?.length) {
            oldImagesForArea = matchingArea.images;
          }
        }

        if (filesArray.length > 0) {
          uploadedUrls = await uploadFilesToLocal(
            filesArray,
            `farms/${area.areaType}`,
            oldImagesForArea
          );
        }

        areaImagesData.push({
          areaType: area.areaType,
          images: uploadedUrls,
        });
      }

      value.areaImages = areaImagesData;
    }

    // ✅ 10. Validate Daily Pricing (supports full_night)
    if (value.dailyPricing?.length) {
      const validateDailyPricing = (dailyPricing) => {
        const seenDates = new Set();
        const timeRegex =
          /^((0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM))$|^([01]\d|2[0-3]):([0-5]\d)$/i;

        const toMinutes = (timeStr) => {
          if (/AM|PM/i.test(timeStr)) {
            const [, hh, mm, meridian] = timeStr.match(
              /(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)/i
            );
            let h = parseInt(hh, 10);
            const m = parseInt(mm, 10);
            if (meridian.toUpperCase() === "PM" && h !== 12) h += 12;
            if (meridian.toUpperCase() === "AM" && h === 12) h = 0;
            return h * 60 + m;
          } else {
            const [h, m] = timeStr.split(":").map(Number);
            return h * 60 + m;
          }
        };

        const buildInterval = (slot, checkIn, checkOut) => {
          if (!timeRegex.test(checkIn) || !timeRegex.test(checkOut)) {
            throw new Error(`Invalid time format for ${slot}.`);
          }
          const start = toMinutes(checkIn);
          let end = toMinutes(checkOut);

          if (
            ["night_slot", "full_day", "full_night"].includes(slot) &&
            end <= start
          ) {
            end += 1440;
          } else if (end <= start) {
            throw new Error(`${slot} checkOut must be after checkIn.`);
          }

          return { slot, start, end };
        };

        const overlaps = (a, b) =>
          Math.max(a.start, b.start) < Math.min(a.end, b.end);

        for (const entry of dailyPricing) {
          const isoDate = new Date(entry.date).toISOString().split("T")[0];
          if (seenDates.has(isoDate))
            throw new Error(`Duplicate pricing for ${isoDate}`);
          seenDates.add(isoDate);

          if (!entry.timings)
            throw new Error(`Timings required for ${isoDate}`);
          const t = entry.timings;

          const intervals = [];
          if (t.full_day)
            intervals.push(
              buildInterval("full_day", t.full_day.checkIn, t.full_day.checkOut)
            );
          if (t.day_slot)
            intervals.push(
              buildInterval("day_slot", t.day_slot.checkIn, t.day_slot.checkOut)
            );
          if (t.night_slot)
            intervals.push(
              buildInterval(
                "night_slot",
                t.night_slot.checkIn,
                t.night_slot.checkOut
              )
            );
          if (t.full_night)
            intervals.push(
              buildInterval(
                "full_night",
                t.full_night.checkIn,
                t.full_night.checkOut
              )
            );

          for (let i = 0; i < intervals.length; i++) {
            for (let j = i + 1; j < intervals.length; j++) {
              const a = intervals[i];
              const b = intervals[j];

              const allowedOverlap =
                (a.slot === "full_day" &&
                  ["day_slot", "night_slot", "full_night"].includes(b.slot)) ||
                (b.slot === "full_day" &&
                  ["day_slot", "night_slot", "full_night"].includes(a.slot)) ||
                (a.slot === "day_slot" &&
                  ["night_slot", "full_night"].includes(b.slot)) ||
                (b.slot === "day_slot" &&
                  ["night_slot", "full_night"].includes(a.slot));

              if (!allowedOverlap && overlaps(a, b)) {
                const allowedPairs = [
                  ["night_slot", "full_night"],
                  ["full_night", "night_slot"],
                ];

                const pair = [a.slot, b.slot];
                const isAllowed = allowedPairs.some(
                  ([s1, s2]) => s1 === pair[0] && s2 === pair[1]
                );

                if (!isAllowed) {
                  throw new Error(
                    `Timing overlap between ${a.slot} and ${b.slot} on ${isoDate}`
                  );
                }
              }
            }
          }
        }

        return dailyPricing;
      };

      try {
        value.dailyPricing = validateDailyPricing(value.dailyPricing);
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
    }

    // ✅ 11. Create or Update Farm Document
    let farmDoc;
    if (farmId) {
      farmDoc = await Farm.findOneAndUpdate(
        { _id: farmId, owner: ownerId },
        { $set: value },
        { new: true }
      );
      if (!farmDoc) {
        return res
          .status(404)
          .json({ success: false, message: "Farm not found." });
      }
    } else {
      if (value.name) {
        const duplicate = await Farm.findOne({
          name: value.name,
          owner: ownerId,
        });
        if (duplicate) {
          return res.status(409).json({
            success: false,
            message: "A farm with this name already exists.",
          });
        }
      }
      farmDoc = await new Farm(value).save();
    }

    // ✅ 12. Populate + Respond
    const populatedFarm = await Farm.findById(farmDoc._id)
      .populate("farmCategory", "_id name")
      .populate("facilities", "_id name")
      .populate("types", "_id name");

    const farmResponse = {
      ...populatedFarm.toObject(),
      Types: populatedFarm.types,
    };
    delete farmResponse.types;

    return res.status(farmId ? 200 : 201).json({
      success: true,
      message: farmId
        ? "Farm updated successfully."
        : "Farm created successfully.",
      data: farmResponse,
    });
  } catch (err) {
    console.error("[AddOrUpdateFarm Error]", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

// exports.addOrUpdateFarm = async (req, res) => {
//   try {
//     // ✅ Parse areaImages if it's sent as a string
//     if (req.body.areaImages && typeof req.body.areaImages === "string") {
//       try {
//         req.body.areaImages = JSON.parse(req.body.areaImages);
//       } catch (err) {
//         return res
//           .status(400)
//           .json({
//             success: false,
//             message: "Invalid JSON format for areaImages",
//           });
//       }
//     }

//     // ✅ Do the same for address, rules, propertyDetails if needed
//     ["rules", "address", "propertyDetails"].forEach((key) => {
//       if (req.body[key] && typeof req.body[key] === "string") {
//         try {
//           req.body[key] = JSON.parse(req.body[key]);
//         } catch {}
//       }
//     });
//     const normalizeFiles = (files) => {
//       if (!files) return [];
//       return Array.isArray(files) ? files : [files];
//     };
//     // ✅ Pre-process "Types" → "types" for validation and DB

// if (req.body.Types?.length) {
//   req.body.types = req.body.Types;
//   delete req.body.Types;
// }
//     // ✅ 1. Validate Request with Joi
//     const { error, value } = VendorValiidation.farmAddValidationSchema.validate(
//       req.body,
//       { abortEarly: false, allowUnknown: true }
//     );

//     if (error) {
//       return res.status(400).json({
//         success: false,
//         message: "Validation failed",
//         errors: error.details.map((err) => err.message),
//       });
//     }

//     const ownerId = req.user.id;
//     value.owner = ownerId;
//     const farmId = value.farmId;

//     // ✅ 2. Verify Vendor
//     const vendor = await Vendor.findById(ownerId);
//     if (!vendor)
//       return res
//         .status(404)
//         .json({ success: false, message: "Vendor not found." });
//     if (!vendor.isVerified || !vendor.isActive || vendor.isBlocked) {
//       return res
//         .status(403)
//         .json({
//           success: false,
//           message: "Vendor is not eligible to create/update farms.",
//         });
//     }

//     // ✅ 3. Validate farmCategory if provided
//     if (value.farmCategory?.length) {
//       const categoryExists = await FarmCategory.find({
//         _id: { $in: value.farmCategory },
//       });
//       if (categoryExists.length !== value.farmCategory.length) {
//         return res
//           .status(400)
//           .json({
//             success: false,
//             message: "One or more farmCategory IDs are invalid.",
//           });
//       }
//     }

//     // ✅ 4. Validate facilities if provided
//     if (value.facilities?.length) {
//       const validFacilities = await Facility.find({
//         _id: { $in: value.facilities },
//       });
//       if (validFacilities.length !== value.facilities.length) {
//         return res
//           .status(400)
//           .json({
//             success: false,
//             message: "One or more facilities IDs are invalid.",
//           });
//       }
//     }

// // ✅ 4.1 Validate and map "Types" from Postman to schema "types"
// if (value.Types?.length) {
//   const incomingTypes = value.Types.filter(Boolean);

//   // Validate ObjectId format
//   const invalidIds = incomingTypes.filter(
//     (id) => !mongoose.Types.ObjectId.isValid(id)
//   );
//   if (invalidIds.length) {
//     return res.status(400).json({
//       success: false,
//       message: "One or more type IDs are not valid ObjectIds.",
//       errors: invalidIds,
//     });
//   }

//   // Check if types actually exist in DB
//   const found = await FarmType.find(
//     { _id: { $in: incomingTypes } },
//     { _id: 1 }
//   ).lean();

//   if (found.length !== incomingTypes.length) {
//     const foundSet = new Set(found.map((t) => String(t._id)));
//     const missing = incomingTypes.filter((id) => !foundSet.has(String(id)));
//     return res.status(400).json({
//       success: false,
//       message: "One or more type IDs do not exist.",
//       errors: missing,
//     });
//   }

//   // ✅ Map into proper ObjectId array for schema
//   console.log("value type printing",value.types)
//   value.types = incomingTypes.map((id) => new mongoose.Types.ObjectId(id));
//   delete value.Types; // Clean up extra field
// }

//     // ✅ 5. Embedded Rules → Ensure Always Array
//     if (value.rules) {
//       if (!Array.isArray(value.rules)) {
//         value.rules = [value.rules]; // normalize single object to array
//       }
//     }

//     // ✅ 6. Embedded Property Details → No DB Lookup
//     if (value.propertyDetails && typeof value.propertyDetails !== "object") {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message: "propertyDetails must be an object.",
//         });
//     }

//     // ✅ 7. Embedded Address → Must Be Object
//     if (value.address) {
//       if (typeof value.address !== "object") {
//         return res
//           .status(400)
//           .json({ success: false, message: "Address must be an object." });
//       }

//       // ✅ Validate mapLink if provided
//       if (value.address.mapLink) {
//         const urlRegex =
//           /^(https?:\/\/)([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w\.-]*)*\/?$/i;
//         if (!urlRegex.test(value.address.mapLink)) {
//           return res
//             .status(400)
//             .json({ success: false, message: "Invalid URL format for mapLink" });
//         }
//       }

//       value.location = {
//         ...value.address,
//         mapLink: value.address.mapLink || null,
//         createdBy: req.user.id,
//       };

//       delete value.address;
//     }
//     // ✅ 8. Handle General Farm Images (main gallery) using cloudinary

//     // if (req.files?.images || req.files?.image) {
//     //   const imagesArray = normalizeFiles(req.files.images || req.files.image);
//     //   if (imagesArray.length > 0) {
//     //     const uploadedUrls = await uploadFilesToCloudinary(
//     //       imagesArray,
//     //       "farms"
//     //     );
//     //     value.images = uploadedUrls;
//     //   }
//     // }
//     // ✅ 8. Handle General Farm Images (main gallery) using local file upload
//     if (req.files?.images || req.files?.image) {
//       const imagesArray = normalizeFiles(req.files.images || req.files.image);
//       if (imagesArray.length > 0) {
//         let oldImages = [];

//         if (farmId) {
//           const existingFarm = await Farm.findOne({ _id: farmId, owner: ownerId });
//           if (existingFarm?.images?.length) {
//             oldImages = existingFarm.images;
//           }
//         }

//         const uploadedUrls = await uploadFilesToLocal(imagesArray, 'farms', oldImages);
//         value.images = uploadedUrls;
//       }
//     }
//     // setp 9 for areawise image using cloudinary

//     // // ✅ 9. Handle Area-wise Images (bedroom, kitchen, etc.)
//     // if (req.body.areaImages) {
//     //   // ✅ Ensure areaImages is parsed if sent as string
//     //   let areaImagesParsed;
//     //   try {
//     //     areaImagesParsed =
//     //       typeof req.body.areaImages === "string"
//     //         ? JSON.parse(req.body.areaImages)
//     //         : req.body.areaImages;
//     //   } catch (err) {
//     //     return res
//     //       .status(400)
//     //       .json({
//     //         success: false,
//     //         message: "Invalid JSON format for areaImages",
//     //       });
//     //   }

//     //   const areaImagesData = [];

//     //   // ✅ Loop through each area group
//     //   for (let i = 0; i < areaImagesParsed.length; i++) {
//     //     const area = areaImagesParsed[i];
//     //     const fieldKey = `areaImages[${i}][images]`; // This matches Postman key names

//     //     // ✅ Find corresponding files in req.files
//     //     const filesArray = normalizeFiles(req.files?.[fieldKey]);
//     //     let uploadedUrls = [];

//     //     if (filesArray.length > 0) {
//     //       uploadedUrls = await uploadFilesToCloudinary(
//     //         filesArray,
//     //         `farms/${area.areaType}`
//     //       );
//     //     }

//     //     // ✅ Push final structure
//     //     areaImagesData.push({
//     //       areaType: area.areaType,
//     //       images: uploadedUrls,
//     //     });
//     //   }

//     //   value.areaImages = areaImagesData;
//     // }

//     // ✅ 9. Handle Area-wise Images (bedroom, kitchen, etc.) using local file upload
//     if (req.body.areaImages) {
//       let areaImagesParsed;
//       try {
//         areaImagesParsed =
//           typeof req.body.areaImages === "string"
//             ? JSON.parse(req.body.areaImages)
//             : req.body.areaImages;
//       } catch (err) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid JSON format for areaImages",
//         });
//       }

//       const areaImagesData = [];

//       for (let i = 0; i < areaImagesParsed.length; i++) {
//         const area = areaImagesParsed[i];
//         const fieldKey = `areaImages[${i}][images]`;

//         const filesArray = normalizeFiles(req.files?.[fieldKey]);
//         let uploadedUrls = [];

//         let oldImagesForArea = [];
//         if (farmId) {
//           const existingFarm = await Farm.findOne({ _id: farmId, owner: ownerId });
//           const matchingArea = existingFarm?.areaImages?.find(
//             (ai) => ai.areaType === area.areaType
//           );
//           if (matchingArea?.images?.length) {
//             oldImagesForArea = matchingArea.images;
//           }
//         }

//         if (filesArray.length > 0) {
//           uploadedUrls = await uploadFilesToLocal(
//             filesArray,
//             `farms/${area.areaType}`,
//             oldImagesForArea
//           );
//         }

//         areaImagesData.push({
//           areaType: area.areaType,
//           images: uploadedUrls,
//         });
//       }

//       value.areaImages = areaImagesData;
//     }
//     // ✅ 9. Validate Daily Pricing (if provided)
//     if (value.dailyPricing?.length) {
//       const validateDailyPricing = (dailyPricing) => {
//         const seenDates = new Set();

//         // Accepts "hh:mm AM/PM" or 24h "HH:MM"
//         const timeRegex =
//           /^((0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM))$|^([01]\d|2[0-3]):([0-5]\d)$/i;

//         const toMinutes0to1439 = (timeStr) => {
//           if (/AM|PM/i.test(timeStr)) {
//             const [, hh, mm, meridian] = timeStr.match(
//               /(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)/i
//             );
//             let h = parseInt(hh, 10);
//             const m = parseInt(mm, 10);
//             if (meridian.toUpperCase() === "PM" && h !== 12) h += 12;
//             if (meridian.toUpperCase() === "AM" && h === 12) h = 0;
//             return h * 60 + m; // 0..1439
//           } else {
//             const [h, m] = timeStr.split(":").map(Number);
//             return h * 60 + m; // 0..1439
//           }
//         };

//         // Build an interval for a given slot on date D.
//         // For same-day slots: start < end within 0..1440
//         // For night_slot, allow crossing midnight: end may be +1440 (next day)
//         // Build an interval for a given slot on date D.
//         const buildInterval = (slotName, checkIn, checkOut) => {
//           if (!timeRegex.test(checkIn) || !timeRegex.test(checkOut)) {
//             throw new Error(
//               `Invalid time format for ${slotName}. Use "hh:mm AM/PM" or "HH:MM".`
//             );
//           }
//           const inMin = toMinutes0to1439(checkIn);
//           const outMin = toMinutes0to1439(checkOut);

//           let start = inMin;
//           let end = outMin;

//           // ✅ Allow overnight rollover for night_slot *and* full_day
//           if (slotName === "night_slot" || slotName === "full_day") {
//             if (end <= start) end += 1440; // treat checkout as “next day”
//           } else {
//             // day_slot must be same-day
//             if (end <= start) {
//               throw new Error(
//                 `Check-In must be before Check-Out for ${slotName} (same day).`
//               );
//             }
//           }

//           const duration = end - start; // minutes
//           if (duration <= 0 || duration > 1440) {
//             throw new Error(
//               `Invalid duration for ${slotName}. Check your times; max 24 hours.`
//             );
//           }

//           return { slot: slotName, start, end }; // 0..2880 scale
//         };

//         // Simple interval overlap check on the same 0..2880 timeline
//         const overlaps = (a, b) => Math.max(a.start, b.start) < Math.min(a.end, b.end);

//         dailyPricing.forEach((p) => {
//           // normalize date label to yyyy-mm-dd (this is the **check-in date**)
//           const isoDate = new Date(p.date).toISOString().split("T")[0];

//           if (seenDates.has(isoDate)) {
//             throw new Error(`Duplicate pricing for ${isoDate}`);
//           }
//           seenDates.add(isoDate);

//           if (!p.timings) throw new Error(`Timings required for ${isoDate}`);

//           const t = p.timings;

//           // Build intervals
//           const intervals = [
//             buildInterval("full_day", t.full_day?.checkIn, t.full_day?.checkOut),
//             buildInterval("day_slot", t.day_slot?.checkIn, t.day_slot?.checkOut),
//             buildInterval("night_slot", t.night_slot?.checkIn, t.night_slot?.checkOut),
//           ];

//           // Optional: sanity constraints (tweak if your business rules differ)
//           // e.g., night slot should typically start evening and end morning
//           // (not hard-failing, but you can uncomment to enforce)
//           // const ns = intervals.find(i => i.slot === 'night_slot');
//           // if (ns.start < 12 * 60) { // starts before noon
//           //   throw new Error(`night_slot should start in the evening on ${isoDate}.`);
//           // }

//           // Ensure no overlaps between the three slots on the same pricing date.
//           // Because night_slot may go past midnight, it's on a 0..2880 scale.
//           // Ensure no overlaps between the three slots unless allowed
//           for (let i = 0; i < intervals.length; i++) {
//             for (let j = i + 1; j < intervals.length; j++) {
//               const a = intervals[i];
//               const b = intervals[j];

//               // ✅ Allowed overlaps:
//               const allowedOverlap =
//                 // full_day with others
//                 (a.slot === "full_day" && ["day_slot", "night_slot"].includes(b.slot)) ||
//                 (b.slot === "full_day" && ["day_slot", "night_slot"].includes(a.slot)) ||
//                 // day_slot with night_slot
//                 (a.slot === "day_slot" && b.slot === "night_slot") ||
//                 (b.slot === "day_slot" && a.slot === "night_slot");

//               if (!allowedOverlap && overlaps(a, b)) {
//                 throw new Error(
//                   `Timing overlap between ${a.slot} and ${b.slot} on ${isoDate}`
//                 );
//               }
//             }
//           }
//         });

//         return dailyPricing;
//       };
//       try {
//         value.dailyPricing = validateDailyPricing(value.dailyPricing);
//       } catch (e) {
//         return res.status(400).json({ success: false, message: e.message });
//       }
//     }

//     // ✅ 10. Create or Update Farm Document
//     let farmDoc;
//     if (farmId) {
//       farmDoc = await Farm.findOneAndUpdate(
//         { _id: farmId, owner: ownerId },
//         { $set: value },
//         { new: true }
//       );
//       if (!farmDoc) {
//         return res
//           .status(404)
//           .json({ success: false, message: "Farm not found ." });
//       }
//     } else {
//       if (value.name) {
//         const duplicate = await Farm.findOne({
//           name: value.name,
//           owner: ownerId,
//         });
//         if (duplicate) {
//           return res
//             .status(409)
//             .json({
//               success: false,
//               message: "A farm with this name already exists.",
//             });
//         }
//       }
//       farmDoc = await new Farm(value).save();
//     }

//     // ✅ 11. Populate References (rules/propertyDetails are embedded, no populate)
//   const populatedFarm = await Farm.findById(farmDoc._id)
//   .populate("farmCategory")
//   .populate("facilities")
//   .populate("types", "_id name"); // ✅ populate types as well

// // ✅ Convert `types` → `Types` for frontend/postman compatibility
// const farmResponse = {
//   ...populatedFarm.toObject(),
//   Types: populatedFarm.types, // 👈 this maps `types` to `Types`
// };
// delete farmResponse.types; // optional: remove lowercase version

//     // ✅ 12. Response
//     return res.status(farmId ? 200 : 201).json({
//       success: true,
//       message: farmId
//         ? "Farm updated successfully."
//         : "Farm created successfully.",
//       data: populatedFarm,
//     });
//   } catch (err) {
//     console.error("[AddOrUpdateFarm Error]", err);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: err.message,
//     });
//   }
// };

exports.unblockDate = async (req, res) => {
  const vendorId = req.user.id;

  // ✅ Validate Request
  const { error, value } = FarmValidation.unblockDateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.details.map((e) => e.message),
    });
  }

  const { farmId, dates } = value;

  try {
    // ✅ Find farm
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res
        .status(404)
        .json({ success: false, message: "Farm not found." });
    }

    // ✅ Ownership check
    if (farm.owner.toString() !== vendorId) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied." });
    }

    const unblocked = [];
    const notBlocked = [];

    // ✅ Process each requested unblocking date & slots
    for (const { date, slots } of dates) {
      const isoReqDate = new Date(date).toISOString().split("T")[0];

      // 🔹 Find existing blocked entry for this date
      const entry = farm.unavailableDates.find((d) => {
        if (!d.date) return false;
        return new Date(d.date).toISOString().split("T")[0] === isoReqDate;
      });

      if (!entry) {
        // No entry found → this date wasn’t blocked at all
        notBlocked.push({ date: isoReqDate, slots });
        continue;
      }

      if (!entry.blockedSlots || entry.blockedSlots.length === 0) {
        // Entry exists but no slots (edge case)
        notBlocked.push({ date: isoReqDate, slots });
        continue;
      }

      // 🔹 Remove requested slots from blockedSlots
      const before = [...entry.blockedSlots];
      entry.blockedSlots = entry.blockedSlots.filter((s) => !slots.includes(s));

      if (entry.blockedSlots.length === 0) {
        // ✅ If no slots remain, remove the entire entry
        farm.unavailableDates = farm.unavailableDates.filter(
          (d) => new Date(d.date).toISOString().split("T")[0] !== isoReqDate
        );
      }

      unblocked.push({
        date: isoReqDate,
        removedSlots: slots.filter((s) => before.includes(s)),
      });
    }

    // ✅ Save only if something changed
    if (unblocked.length > 0) await farm.save();

    // ✅ Response
    return res.status(200).json({
      success: true,
      message: "Farm slot unblocking completed.",
      summary: {
        unblockedCount: unblocked.length,
        notBlockedCount: notBlocked.length,
      },
      details: {
        unblocked,
        notBlocked,
        currentUnavailableDates: farm.unavailableDates.map((d) => ({
          date: new Date(d.date).toISOString().split("T")[0],
          slots: d.blockedSlots,
        })),
      },
    });
  } catch (err) {
    console.error("❌ Error while unblocking slots:", err);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while unblocking slots.",
    });
  }
};

exports.blockDate = async (req, res) => {
  try {
    // ✅ Step 1: Validate input
    const { error, value } = FarmValidation.blockDateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    const vendorId = req.user.id;
    const { farmId, dates } = value;

    // ✅ Step 2: Find farm
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res
        .status(404)
        .json({ success: false, message: "Farm not found." });
    }

    // ✅ Step 3: Ownership check
    if (farm.owner.toString() !== vendorId) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied." });
    }

    const newlyBlocked = [];
    const alreadyBlocked = [];

    // ✅ Step 4: Iterate over each date-slot pair
    for (const { date, slots } of dates) {
      const dateObj = new Date(date);

      // 🔹 Validate date
      if (isNaN(dateObj.getTime())) {
        console.warn(`⚠️ Skipping invalid date:`, date);
        continue;
      }

      const normalizedDate = DateTime.fromJSDate(dateObj).toISODate();

      // 🔹 Find if this date already exists in DB
      const existing = farm.unavailableDates.find((d) => {
        if (!d.date) return false;
        const storedISO = DateTime.fromJSDate(new Date(d.date)).toISODate();
        return storedISO === normalizedDate;
      });

      if (existing) {
        // 🔹 Merge new slots (avoid duplicates)
        const newSlots = slots.filter(
          (s) => !existing.blockedSlots.includes(s)
        );
        if (newSlots.length > 0) {
          existing.blockedSlots.push(...newSlots);
          newlyBlocked.push({ date: normalizedDate, slots: newSlots });
        } else {
          alreadyBlocked.push({ date: normalizedDate, slots });
        }
      } else {
        // 🔹 Add a new date entry
        farm.unavailableDates.push({ date: dateObj, blockedSlots: slots });
        newlyBlocked.push({ date: normalizedDate, slots });
      }
    }

    // ✅ Step 5: Save if there were changes
    if (newlyBlocked.length > 0) await farm.save();

    // ✅ Step 6: Respond
    return res.status(200).json({
      success: true,
      message: "Farm slot availability updated successfully.",
      summary: {
        newlyBlockedCount: newlyBlocked.length,
        alreadyBlockedCount: alreadyBlocked.length,
      },
      details: {
        newlyBlocked,
        alreadyBlocked,
        allUnavailableDates: farm.unavailableDates.map((d) => ({
          date: DateTime.fromJSDate(new Date(d.date)).toISODate(),
          slots: d.blockedSlots,
        })),
      },
    });
  } catch (err) {
    console.error("❌ Error while blocking dates:", err);
    return res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while blocking dates. Please try again later.",
    });
  }
};

 // step wise farm add if required

// exports.handleFarmSteps = async (req, res) => {
//   try {
//     const { step, farmId } = req.body;
//     const ownerId = req.user.id;

//     if (!step) return res.status(400).json({ success: false, message: "Step is required" });

//     // ✅ Vendor verification
//     const vendor = await Vendor.findById(ownerId);
//     if (!vendor || !vendor.isVerified || !vendor.isActive || vendor.isBlocked) {
//       return res.status(403).json({ success: false, message: "Vendor not authorized to create/update farms" });
//     }

//     let updateData = {};
//     let farmDoc;

//     // ✅ Step-wise logic
//     switch (parseInt(step)) {
//       /**
//        * STEP 1: Create Farm with Basic Info & Address
//        */
//    case 1: {
//   const { name, description, address } = req.body;

//   if (!name || !address) {
//     return res.status(400).json({ success: false, message: "Name & Address are required for Step 1" });
//   }

//   if (farmId) {
//     // ✅ If farmId exists, update existing farm instead of creating new
//     farmDoc = await Farm.findOneAndUpdate(
//       { _id: farmId, owner: ownerId },
//       { $set: { name, description, address, currentStep: 1 } },
//       { new: true }
//     );
//     if (!farmDoc) return res.status(404).json({ success: false, message: "Farm not found" });
//   } else {
//     // ✅ If no farmId, create a new farm
//     farmDoc = new Farm({ name, description, address, owner: ownerId, isDraft: true, currentStep: 1 });
//     await farmDoc.save();
//   }
//   break;
// }

//       /**
//        * STEP 2: Update Capacity, Category, Default Pricing & Timings
//        */
//       case 2: {
//         if (!farmId) return res.status(400).json({ success: false, message: "farmId is required" });

//         const { capacity, farmCategory, defaultPricing, defaultTimings } = req.body;

//         if (farmCategory) {
//           const categoryExists = await FarmCategory.findById(farmCategory);
//           if (!categoryExists) return res.status(400).json({ success: false, message: "Invalid farm category ID" });
//         }

//         updateData = { capacity, farmCategory, defaultPricing, defaultTimings, currentStep: 2 };
//         farmDoc = await Farm.findOneAndUpdate({ _id: farmId, owner: ownerId }, { $set: updateData }, { new: true });
//         if (!farmDoc) return res.status(404).json({ success: false, message: "Farm not found" });
//         break;
//       }

//       /**
//        * STEP 3: Update Daily Pricing & Timings
//        */
//       case 3: {
//         if (!farmId) return res.status(400).json({ success: false, message: "farmId is required" });

//         const { dailyPricing } = req.body;
//         if (!Array.isArray(dailyPricing) || !dailyPricing.length) {
//           return res.status(400).json({ success: false, message: "dailyPricing must be a non-empty array" });
//         }

//         updateData = { dailyPricing, currentStep: 3 };
//         farmDoc = await Farm.findOneAndUpdate({ _id: farmId, owner: ownerId }, { $set: updateData }, { new: true });
//         break;
//       }

//       /**
//        * STEP 4: Update Facilities & Rules
//        */
//       case 4: {
//         if (!farmId) return res.status(400).json({ success: false, message: "farmId is required" });

//         const { facilities, rules } = req.body;
//         if (facilities?.length) {
//           const validFacilities = await Facility.find({ _id: { $in: facilities } });
//           if (validFacilities.length !== facilities.length) {
//             return res.status(400).json({ success: false, message: "Invalid facility ID(s)" });
//           }
//         }

//         updateData = { facilities, rules, currentStep: 4 };
//         farmDoc = await Farm.findOneAndUpdate({ _id: farmId, owner: ownerId }, { $set: updateData }, { new: true });
//         break;
//       }

//       /**
//        * STEP 5: Update Property Details
//        */
//       case 5: {
//         if (!farmId) return res.status(400).json({ success: false, message: "farmId is required" });

//         const { propertyDetails } = req.body;
//         if (!propertyDetails) return res.status(400).json({ success: false, message: "propertyDetails is required" });

//         updateData = { propertyDetails, currentStep: 5 };
//         farmDoc = await Farm.findOneAndUpdate({ _id: farmId, owner: ownerId }, { $set: updateData }, { new: true });
//         break;
//       }

//       /**
//        * STEP 6: Upload Area Images (multipart/form-data)
//        */
//       case 6: {
//         const farmIdForm = req.body.farmId || req.query.farmId;
//         if (!farmIdForm) return res.status(400).json({ success: false, message: "farmId is required" });

//         let areaImagesData = [];

//         // ✅ Loop through areaTypes
//         Object.keys(req.body).forEach((key) => {
//           if (key.startsWith("areaImages")) {
//             // areaImages[0][areaType]: Pool
//             const match = key.match(/areaImages\[(\d+)\]\[areaType\]/);
//             if (match) {
//               const index = parseInt(match[1]);
//               areaImagesData[index] = areaImagesData[index] || {};
//               areaImagesData[index].areaType = req.body[key];
//               areaImagesData[index].images = [];
//             }
//           }
//         });

//         // ✅ Handle image uploads per areaType
//         for (let i = 0; i < areaImagesData.length; i++) {
//           const fieldKey = `areaImages[${i}][images]`;
//           if (req.files?.[fieldKey]) {
//             const filesArray = Array.isArray(req.files[fieldKey]) ? req.files[fieldKey] : [req.files[fieldKey]];
//             const uploadedUrls = await uploadFilesToCloudinary(filesArray, `farms/${areaImagesData[i].areaType}`);
//             areaImagesData[i].images = uploadedUrls;
//           }
//         }

//         updateData = { areaImages: areaImagesData, currentStep: 6, isDraft: false, isApproved: true };
//         farmDoc = await Farm.findOneAndUpdate({ _id: farmIdForm, owner: ownerId }, { $set: updateData }, { new: true });
//         break;
//       }

//       default:
//         return res.status(400).json({ success: false, message: "Invalid step" });
//     }

//     // ✅ Populate refs & send response
//     const populatedFarm = await Farm.findById(farmDoc._id).populate("farmCategory").populate("facilities");

//     return res.status(200).json({
//       success: true,
//       message: `Step ${step} processed successfully`,
//       data: populatedFarm
//     });

//   } catch (err) {
//     console.error("[FarmStepController Error]", err);
//     return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
//   }
// };

// get Category and facilites apis

// get vendor farms

exports.getVendorFarms = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // ✅ Validate Body
    const { error, value } = VendorValiidation.getVendorFarmsSchema.validate(
      req.body,
      {
        abortEarly: false,
        allowUnknown: true,
      }
    );
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    let { search, status, page, limit } = value;

    // ✅ Defaults for empty strings
    if (!search) search = "";
    if (!status || status === "") status = "all";

    // ✅ Base Query
    const query = { owner: ownerId };

    // ✅ Status Filter
    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;

    // ✅ Search Handling
    if (search.trim() !== "") {
      if (mongoose.Types.ObjectId.isValid(search.trim())) {
        // 🔥 If search is a valid Mongo ID → search by ID
        query._id = search.trim();
      } else {
        // 🔥 Else → search by name regex
        query.name = { $regex: search.trim(), $options: "i" };
      }
    }

    const skip = (page - 1) * limit;

    // ✅ Fetch Farms
    const farms = await Farm.find(query)
      .populate("farmCategory", "_id name")
      .populate("facilities", "_id name")
      .populate("types", "_id name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalFarms = await Farm.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: "Farms fetched successfully",
      total: totalFarms,
      page,
      limit,
      data: farms,
    });
  } catch (err) {
    console.error("[GetVendorFarms Error]", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

exports.getVendorFarmById = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // ✅ 1. Validate Request Body
    const { error, value } = VendorValiidation.getFarmByVendorSchema.validate(
      req.body,
      { abortEarly: false }
    );
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    const { farmId } = value;

    // ✅ 2. Check if farmId is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(farmId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid farmId format",
      });
    }

    // ✅ 3. Check if farm exists (without owner check first)
    const farmExists = await Farm.findById(farmId)
      .populate("farmCategory", "_id name")
      .populate("facilities", "_id name icon")
      .populate("types", "_id name ");

    if (!farmExists) {
      return res.status(404).json({
        success: false,
        message:
          "Farm not found. Please check the farmId and try again.This Farm Not Belongs To YOU!!!!",
      });
    }

    // ✅ 4. Check if the farm belongs to the vendor
    if (farmExists.owner.toString() !== ownerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this farm.",
      });
    }

    // ✅ 5. Send Success Response
    return res.status(200).json({
      success: true,
      message: "Farm details fetched successfully",
      data: farmExists,
    });
  } catch (err) {
    console.error("[GetVendorFarmById Error]", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

// get all facilites and categories  without any restriction

exports.getAllFacilities = async (req, res) => {
  try {
    // You can add query filters later if needed
    const facilities = await Facility.find({}, "_id name").sort({
      createdAt: -1,
    });

    if (!facilities || facilities.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No facilities found",
      });
    }

    res.status(200).json({
      success: true,
      count: facilities.length,
      data: facilities,
    });
  } catch (error) {
    console.error("Error fetching facilities:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
exports.getAllCategories = async (req, res) => {
  try {
    // You can add query filters later if needed
    const farmCategory = await FarmCategory.find({}, "_id name").sort({
      createdAt: -1,
    });

    if (!farmCategory || farmCategory.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No farmCategory found",
      });
    }

    res.status(200).json({
      success: true,
      count: farmCategory.length,
      data: farmCategory,
    });
  } catch (error) {
    console.error("Error fetching farmCategory:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
exports.getAllTypes = async (req, res) => {
  try {
    const types = await Types.find().sort({ createdAt: -1 });

    if (!types || types.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No types found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Types fetched successfully",
      data: types,
    });
  } catch (err) {
    console.error("getAllTypes error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateFarmImages = async (req, res) => {
  try {
    // ✅ Step 1: Validate body
    const { error, value } = VendorValiidation.updateFarmImagesSchema.validate(
      req.body,
      { abortEarly: false }
    );
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    const { farm_id } = value;

    // ✅ Step 2: Check if farm exists
    const farm = await Farm.findById(farm_id);
    if (!farm) {
      return res.status(404).json({ error: "Farm not found" });
    }

    // ✅ Step 3: Check if files are uploaded
    const uploadedFiles = req.files?.images || req.files?.image;
    if (!uploadedFiles) {
      return res.status(400).json({ error: "No images uploaded." });
    }

    // ✅ Step 4: Normalize files array
    const filesArray = Array.isArray(uploadedFiles)
      ? uploadedFiles
      : [uploadedFiles];

    // ✅ Step 5: Upload new images to Cloudinary
    const newImageUrls = await uploadFilesToCloudinary(filesArray, "farms");

    // ✅ Step 6: Replace old images with new images
    farm.images = newImageUrls;

    // ✅ Step 7: Save updated farm
    await farm.save();

    // ✅ Step 8: Response
    return res.status(200).json({
      message: "Farm images replaced successfully",
      newImages: newImageUrls,
    });
  } catch (err) {
    console.error("[updateFarmImages Error]", err);
    return res
      .status(500)
      .json({ error: "Server error. Please try again later." });
  }
};

// delete farm

exports.deleteVendorFarm = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ownerId = req.user.id;

    // ✅ 1. Validate Body
    const { error, value } = VendorValiidation.deleteVendorFarmSchema.validate(
      req.body,
      { abortEarly: false }
    );
    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    const { farmId } = value;

    // ✅ 2. Check ObjectId Validity
    if (!mongoose.Types.ObjectId.isValid(farmId)) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "Invalid farmId format" });
    }

    // ✅ 3. Find Farm
    const farm = await Farm.findById(farmId).session(session);
    if (!farm) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Farm not found. Please check the farmId.",
      });
    }

    // ✅ 4. Ownership Check
    // if (farm.owner.toString() !== ownerId.toString()) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(403).json({
    //     success: false,
    //     message: "You are not authorized to delete this farm.",
    //   });
    // }

    // ✅ 5. Cancel All Related Bookings
    const cancelResult = await FarmBooking.updateMany(
      { farm: farmId, status: { $nin: ["cancelled", "complete"] } },
      { $set: { status: "cancelled" } },
      { session }
    );
    // ✅ 6. Instead of hard delete, soft delete
    farm.isActive = false;
    farm.isApproved = false;
    farm.isHold = true;
    farm.isDraft = true;
    farm.deletedAt = new Date(); // 👈 Optional, to know when it was deleted
    await farm.save({ session });

    // ✅ 7. Return Response
    return res.status(200).json({
      success: true,
      message: `Farm '${farm.name}' deleted successfully. ${cancelResult.modifiedCount} bookings were cancelled.`,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[DeleteVendorFarm Error]", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

// vendor booking related

exports.getVendorFarmBookings = async (req, res) => {
  try {
    const vendorId = req.user.id;

    // ✅ 1. Validate Request Body
    const { error, value } = VendorValiidation.getVendorBookingsSchema.validate(
      req.body,
      { abortEarly: false, allowUnknown: true }
    );
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    let { status, search, startDate, endDate, page, limit } = value;

    // ✅ Normalize empty strings
    if (!status) status = ""; // means no status filter
    if (!search) search = "";

    // ✅ 2. Get all farms owned by vendor
    const vendorFarms = await Farm.find({ owner: vendorId })
      .select("_id")
      .lean();
    if (!vendorFarms.length) {
      return res.status(404).json({
        success: false,
        message: "No farms found for this vendor. No bookings available.",
      });
    }

    const farmIds = vendorFarms.map((f) => f._id);

    // ✅ 3. Build Booking Query
    const query = { farm: { $in: farmIds } };

    if (status) query.status = status;

    // ✅ 4. Search by customer name or phone
    if (search && search.trim() !== "") {
      query.$or = [
        { customerName: { $regex: search.trim(), $options: "i" } },
        { customerPhone: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // ✅ 5. Filter by date range
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }

    // ✅ 6. Pagination
    const skip = (page - 1) * limit;

    // ✅ 7. Fetch Bookings (Optimized with .lean())
    const bookings = await FarmBooking.find(query)
      .populate("farm", "_id name address farmCategory")
      .sort({ date: -1 }) // latest bookings first
      .skip(skip)
      .limit(limit)
      .lean();

    const totalBookings = await FarmBooking.countDocuments(query);

    // ✅ 8. Response
    return res.status(200).json({
      success: true,
      message: "Vendor farm bookings fetched successfully",
      total: totalBookings,
      page,
      limit,
      data: bookings,
    });
  } catch (err) {
    console.error("[GetVendorFarmBookings Error]", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

exports.getBookingByBookingId = async (req, res) => {
  try {
    // ✅ Step 1: Validate input
    const { error, value } = VendorValiidation.getBookingByIdSchema.validate(
      req.body,
      { abortEarly: false }
    );
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    const { booking_id } = value;

    // ✅ Step 2: Find booking with populated farm
    const booking = await FarmBooking.findOne({ Booking_id: booking_id })
      .populate("customer")
      .populate("farm");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // ✅ Step 3: Convert to object
    const bookingObj = booking.toObject();

    // ✅ Helper to convert HH:mm → hh:mm AM/PM
    const toAmPm = (time) => {
      if (!time) return null;
      let [h, m] = time.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
    };

    // ✅ Step 4: Extract checkIn/checkOut for booking date
    let checkInOut = {};
    if (bookingObj.farm?.dailyPricing && bookingObj.date) {
      const bookingDate = new Date(bookingObj.date).toISOString().split("T")[0];

      const matched = bookingObj.farm.dailyPricing.find((dp) => {
        const dpDate = new Date(dp.date).toISOString().split("T")[0];
        return dpDate === bookingDate;
      });

      if (matched) {
        checkInOut = {
          checkIn: toAmPm(matched.checkIn),
          checkOut: toAmPm(matched.checkOut),
        };
      }
    }

    // ✅ Step 5: Remove unwanted fields
    delete bookingObj.__v;
    delete bookingObj.createdAt;
    delete bookingObj.updatedAt;

    if (bookingObj.farm) {
      delete bookingObj.farm.__v;
      delete bookingObj.farm.createdAt;
      delete bookingObj.farm.updatedAt;
      delete bookingObj.farm.location;
      delete bookingObj.farm.defaultPricing;
      delete bookingObj.farm.farmCategory;
      delete bookingObj.farm.images;
      delete bookingObj.farm.bookingModes;
      delete bookingObj.farm.facilities;
      delete bookingObj.farm.owner;
      delete bookingObj.farm.currency;
      delete bookingObj.farm.capacity;
      delete bookingObj.farm.unavailableDates;
      delete bookingObj.farm.isActive;
      delete bookingObj.farm.isApproved;
      delete bookingObj.farm.dailyPricing;

      // ✅ Add only AM/PM formatted times
      bookingObj.farm.checkInOut = checkInOut;
    }

    // ✅ Step 6: Send clean response
    res.status(200).json({
      message: "Booking details fetched successfully",
      data: bookingObj,
    });
  } catch (err) {
    console.error("[GetBookingByBookingId Error]", err);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
};

// Vendor update booking status

exports.updateBookingStatusByVendor = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { bookingId, status } = req.body;

    const allowedStatuses = ["pending", "confirmed", "cancelled", "complete"];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    const booking = await FarmBooking.findOne({ Booking_id: bookingId }).populate("farm", "owner");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (!booking.farm || booking.farm.owner.toString() !== vendorId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    booking.status = status;

    if (status === "confirmed") {
      booking.paymentStatus = "paid";

      const currentDate = moment(booking.date);
      const nextDate = currentDate.clone().add(1, 'days').toDate();

      const currentSlotQuery = { _id: { $ne: booking._id }, farm: booking.farm._id, status: "pending", date: booking.date };
      const nextDaySlotQuery = { _id: { $ne: booking._id }, farm: booking.farm._id, status: "pending", date: nextDate };

      let currentDaySlotsToCancel = [];
      let nextDaySlotsToCancel = [];

      const modes = booking.bookingModes;
      if (modes.includes("day_slot")) {
        currentDaySlotsToCancel = ["day_slot", "full_day", "full_night"];
      } else if (modes.includes("night_slot")) {
        currentDaySlotsToCancel = ["night_slot", "full_day", "full_night"];
      } else if (modes.includes("full_day")) {
        currentDaySlotsToCancel = ["day_slot", "night_slot", "full_day", "full_night"];
      } else if (modes.includes("full_night")) {
        currentDaySlotsToCancel = ["night_slot", "full_day", "full_night"];
        nextDaySlotsToCancel = ["day_slot"];
      }

      // Cancel current day conflicting bookings
      if (currentDaySlotsToCancel.length) {
        await FarmBooking.updateMany(
          {
            ...currentSlotQuery,
            bookingModes: { $in: currentDaySlotsToCancel },
          },
          { $set: { status: "cancelled" } }
        );
      }

      // Cancel next day conflicting bookings
      if (nextDaySlotsToCancel.length) {
        await FarmBooking.updateMany(
          {
            ...nextDaySlotQuery,
            bookingModes: { $in: nextDaySlotsToCancel },
          },
          { $set: { status: "cancelled" } }
        );
      }
    }

    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Booking status updated",
      data: booking,
    });
  } catch (err) {
    console.error("updateBookingStatusByVendor error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};



