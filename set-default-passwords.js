const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Import models and database connection
require('dotenv').config();
const User = require('./src/models/User');
const { connectDB } = require('./src/config/database');

async function setDefaultPasswords() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    
    console.log('🔐 Setting default passwords for all users...');
    
    const defaultPassword = '123456'; // Common default password
    console.log(`Default password will be: ${defaultPassword}`);
    
    // Hash the default password
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);
    
    // Update all users except admins to have the default password
    const result = await User.updateMany(
      { role: { $ne: 'admin' } }, // Exclude admin users
      { 
        password: hashedPassword,
        updatedBy: 'default-password-setup',
        updatedAt: new Date()
      }
    );
    
    console.log(`✅ Updated passwords for ${result.modifiedCount} non-admin users!`);
    
    // Get counts by role
    const userCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📊 Password updated for users by role:');
    userCounts.forEach(role => {
      if (role._id !== 'admin') {
        console.log(`   ${role._id}: ${role.count} users`);
      }
    });
    
    console.log('\n📝 Test these credentials:');
    
    // Show some sample users for testing
    const sampleUsers = await User.find({ role: { $ne: 'admin' } })
      .select('userid username loginid role')
      .limit(5)
      .sort({ updatedAt: -1 });
    
    console.log('\n🧪 Sample users for testing login:');
    sampleUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. Login ID: ${user.loginid}`);
      console.log(`      Password: ${defaultPassword}`);
      console.log(`      Name: ${user.username}`);
      console.log(`      Role: ${user.role}`);
      console.log('');
    });
    
    console.log('🎯 Login URLs:');
    console.log('   Regular users: http://localhost:3000/login.html');
    console.log('   Admin users: http://localhost:3000/admin-login.html (password unchanged)');
    
  } catch (error) {
    console.error('❌ Error setting default passwords:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

console.log('🚀 Starting default password setup...');
setDefaultPasswords();