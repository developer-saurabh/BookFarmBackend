const express = require('express');
require('dotenv').config();

const connectDB = require('./config/db');
const chatRoutes = require('./routes/chatRoutes');
const venueRoutes = require('./routes/venueRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const AdminRoutes = require('./routes/adminRoutes');
const farmRoutes =require("./routes/farmRoutes")
const userRoutes=require('./routes/userRoutes.js')
const fileUpload = require('express-fileupload');

// ✅ Connect DB
connectDB();

const app = express();

// ✅ Body parsers FIRST
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/' // or Windows safe path
}));
// ✅ Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API health is okay'
  });
});

// ✅ Your routes
app.use('/api/chat', chatRoutes);
app.use('/api/venue', venueRoutes);
app.use('/api/farm', farmRoutes);
app.use('/api/vendor',vendorRoutes );
app.use('/api/admin',AdminRoutes );
app.use('/api/user',userRoutes );



// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
