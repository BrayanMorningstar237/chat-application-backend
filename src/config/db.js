// backend/src/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Remove the deprecated options - they're no longer needed
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database Name: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });
    
    return conn;
    
  } catch (error) {
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);
    // Don't exit the process, just log the error
    return null;
  }
};

module.exports = connectDB;