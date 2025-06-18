const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const chatRoutes = require('./routes/chatRoutes');
const venueRoutes = require('./routes/venueRoutes');
dotenv.config();
connectDB();

const app = express();
app.use(express.json());  // For JSON
app.use(express.urlencoded({ extended: false }));  // For Twilio webhooks


app.use('/api/chat', chatRoutes);
app.use('/api/venues', venueRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
