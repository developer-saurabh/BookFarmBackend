const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const connectDB = require('./config/db');

const vendorRoutes = require('./routes/vendorRoutes');
const AdminRoutes = require('./routes/adminRoutes');
const farmRoutes =require("./routes/farmRoutes")
const RapidBookRoute =require("./routes/RapidBookRoute.js")
const userRoutes=require('./routes/userRoutes.js')
const fileUpload = require('express-fileupload');

// ✅ Connect DB
connectDB();


const app = express();

// ✅ Enable CORS (you can customize the origin)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));


// ✅ Body parsers FIRST
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// for cloudinary uploads

// app.use(fileUpload({
//   useTempFiles: true,
//   tempFileDir: '/tmp/' // or Windows safe path
// }));

// for local uplads


app.use(fileUpload({
  useTempFiles: false, // Directly upload to destination folder
  limits: { fileSize: 5 * 1024 * 1024 }, // Optional limit
}));


// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ✅ Health check
app.get("/",(req,res)=>{
  res.json({
    success:true,
    message:"deployed on vercel success"
  })
})
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API health is okay'
  });
});

// ✅ Your routes
app.use('/api/farm', farmRoutes);
app.use('/api/vendor',vendorRoutes );
app.use('/api/admin',AdminRoutes );
app.use('/api/user',userRoutes );
app.use('/api/Rapid_Book',RapidBookRoute );






// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
