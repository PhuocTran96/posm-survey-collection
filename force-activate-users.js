const mongoose = require('mongoose');

// Import models and database connection
require('dotenv').config();
const User = require('./src/models/User');
const { connectDB } = require('./src/config/database');

async function forceActivateAllUsers() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    
    console.log('🔄 Force activating ALL users in the database...');
    
    // Force update ALL users to be active, regardless of current status
    const result = await User.updateMany(
      {}, // Empty filter = all users
      { 
        isActive: true,
        updatedBy: 'force-activation',
        updatedAt: new Date()
      }
    );
    
    console.log(`✅ Force updated ${result.modifiedCount} users to active status!`);
    
    // Get final counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    
    console.log(`\n📊 Final Status:`);
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Active users: ${activeUsers}`);
    console.log(`   Inactive users: ${inactiveUsers}`);
    
    // Show sample of users
    console.log('\n📝 Sample users status:');
    const sampleUsers = await User.find({})
      .select('userid username loginid role isActive')
      .limit(5)
      .sort({ updatedAt: -1 });
    
    sampleUsers.forEach((user, index) => {
      const status = user.isActive ? '✅ Active' : '❌ Inactive';
      console.log(`   ${index + 1}. ${user.username} (${user.loginid}) - ${user.role} - ${status}`);
    });
    
    if (inactiveUsers === 0) {
      console.log('\n🎉 SUCCESS: All users are now active and can login!');
    } else {
      console.log(`\n⚠️  WARNING: ${inactiveUsers} users are still inactive after force update`);
    }
    
  } catch (error) {
    console.error('❌ Error force activating users:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

console.log('🚀 Starting FORCE user activation...');
forceActivateAllUsers();