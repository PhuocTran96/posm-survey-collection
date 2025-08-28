const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

const setupDatabaseEvents = (db) => {
  db.on('error', (error) => {
    console.error('MongoDB connection error:', error.message);
  });

  db.on('disconnected', () => {
    console.log('MongoDB disconnected');
  });

  db.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });
};

module.exports = { connectDB, setupDatabaseEvents };
