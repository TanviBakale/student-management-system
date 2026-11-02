import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required. Add your MongoDB Atlas connection string to backend/.env.');
  }
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri) || /[<>]/.test(uri)) {
    throw new Error('MONGODB_URI must be a complete MongoDB connection string with real credentials; do not use placeholder values.');
  }

  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, { dbName: 'studentDB', serverSelectionTimeoutMS: 10000 });
  } catch (error) {
    if (error.code === 18 || /bad auth|authentication failed/i.test(error.message || '')) {
      throw new Error('MongoDB authentication failed. Verify the Atlas database user credentials and percent-encode reserved characters in the username or password.');
    }
    throw new Error(`Unable to connect to MongoDB. Check the Atlas URI, cluster status, and network access (${error.name || 'connection error'}).`);
  }
  console.log('Connected to MongoDB Atlas.');
}
