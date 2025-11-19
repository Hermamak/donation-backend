const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// 1. Load Environment Variables (Connection string & Password)
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// 2. Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB successfully connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 3. Define the Data Structure (Schema)
const donationSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  address: { type: String, required: true },
  country: { type: String, required: true },
  amount: { type: Number, required: true },
  // Simulated Credit Card Data (Stored for demo purposes only)
  cardNumber: { type: String, required: true },
  cardExpiry: { type: String, required: true },
  cardCvc: { type: String, required: true },
});

const Donation = mongoose.model('Donation', donationSchema);

// 4. Admin Session Storage (In-memory is fine for this demo)
const adminSessions = new Set();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serves your frontend

// 5. Routes

// Root Route: Serves the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper Middleware: Protects Admin Routes
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing' });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  if (!adminSessions.has(token)) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
  req.adminToken = token;
  next();
}

// API: Handle New Donation
app.post('/api/donations', async (req, res) => {
  try {
    const newDonation = new Donation(req.body);
    await newDonation.save(); // Saves to MongoDB
    res.status(201).json({ message: 'Donation received' });
  } catch (error) {
    console.error('Save Error:', error);
    res.status(500).json({ message: 'Error saving donation' });
  }
});

// API: Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Incorrect password' });
  }
  const token = uuidv4();
  adminSessions.add(token);
  res.json({ token });
});

// API: Admin Logout
app.post('/api/admin/logout', authenticateAdmin, (req, res) => {
  adminSessions.delete(req.adminToken);
  res.json({ message: 'Logged out successfully' });
});

// API: Get All Donations (Protected)
app.get('/api/admin/donations', authenticateAdmin, async (req, res) => {
  try {
    const donations = await Donation.find({}).sort({ timestamp: -1 });
    res.json({ donations });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching records' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});