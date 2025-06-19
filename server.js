const express = require('express');

// ✅ Load env FIRST
require('dotenv').config();

const connectDB = require('./config/db');
const chatRoutes = require('./routes/chatRoutes');
const venueRoutes = require('./routes/venueRoutes');

// ✅ Now connect DB
connectDB();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/chat', chatRoutes);
app.use('/api/venues', venueRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
