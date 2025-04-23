const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // In development (npm start), NODE_ENV is automatically set to 'development'
    // In production (Vercel), NODE_ENV is automatically set to 'production'
    const isDevelopment = process.env.NODE_ENV === 'development';
    console.log('Current NODE_ENV:', process.env.NODE_ENV);
    
    // Use different MongoDB URIs for development and production
    const uri = isDevelopment 
      ? process.env.MONGODB_URI.replace('kairos', 'kairos-dev') // Use development database
      : process.env.MONGODB_URI.replace('kairos', 'kairos-prod');                                 // Use production database
    
    console.log('Connecting to database:', isDevelopment ? 'kairos-dev' : 'kairos-prod');
    
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected to ${isDevelopment ? 'development' : 'production'} database at: ${conn.connection.host}`);
    // Log the current database name
    console.log('Current database name:', conn.connection.db.databaseName);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
