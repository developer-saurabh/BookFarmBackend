const mongoose = require('mongoose');
// require("dotenv").config()
// console.log("mogno uri printing",process.env.MONGO_URI)
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1); // Stop server if DB fails
  }
};

module.exports = connectDB;
