const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chainjudge';

let isConnected = false;

async function connectDB() {
  if (isConnected) return isConnected;

  try {
    await mongoose.connect(MONGO_URI);
    isConnected = true;
    console.log('✅ MongoDB connected at:', MONGO_URI);
  } catch (err) {
    isConnected = false;
    console.warn('⚠️  MongoDB connection failed:', err.message);
    console.warn('⚠️  Running without persistent database.');
  }

  return isConnected;
}

function getStatus() {
  return isConnected ? 'MongoDB (Active)' : 'In-Memory Fallback';
}

module.exports = { connectDB, getStatus };
