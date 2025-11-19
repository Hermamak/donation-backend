const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
// const path = require('path'); // Path is no longer needed

// 1. Load Environment Variables (Connection string & Password)
// IMPORTANT: .env file is NOT deployed to Render. The keys/values must be set in the Render dashboard.
require('dotenv').config();

const app = express();
// Ensure PORT correctly uses the environment variable provided by Render (10000)
// Using || 3000 is still good practice for local development.
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
  address: { type: String }, // ✅ CORRECTED: Made optional by removing required: true
  country: { type: String, required: true },
  amount: { type: Number, required: true },
  // Simulated Credit Card Data (Stored for demo purposes only)
  cardNumber: { type: String, required: true },
  cardExpiry: { type: String, required: true },
  // ❌ CRITICAL FIX: Changed type from 'true' to 'String'
  cardCvc: { type: String, required: true }, 
});

const Donation = mongoose.model('Donation', donationSchema);

// 4. Admin Session Storage (In-memory is fine for this demo)
const adminSessions = new Set();

// 🟢 CRITICAL FIX: Configure CORS to explicitly allow the Vercel domain
const allowedOrigins = [
  'https://war-kids-org.vercel.app', // <-- ALLOWS YOUR LIVE FRONTEND
  'http://localhost:3000',           // Allows local development testing
];

app.use(cors({
  origin: (origin, callback) => {
    // Check if the request origin is in our allowed list or if it's a request with no origin (like a mobile app)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true // Important if you were using cookies/sessions, good practice anyway
}));

app.use(bodyParser.json());
// ❌ REMOVED: app.use(express.static(path.join(__dirname, 'public'))); 
// This line caused the ENOENT error because the 'public' folder doesn't exist.

// 5. Routes

// Root Route: API Check Route
// ✅ MODIFIED: This route now confirms the API is live, instead of trying to serve a file.
app.get('/', (req, res) => {
  // res.sendFile(path.join(__dirname, 'public', 'index.html')); // ❌ REMOVED
  res.json({ status: 'live', message: 'Donation API is running!' });
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
    console.error('Save Error:', error); // Review Render logs for detailed errors!
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
