const mongoose = require('mongoose');

// Import models and database connection
require('dotenv').config();
const User = require('./src/models/User');
const { connectDB } = require('./src/config/database');

async function activateAllUsers() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    
    console.log('📊 Checking current user status...');
    
    // Get current counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    
    console.log(`\n📈 Current Status:`);
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Active users: ${activeUsers}`);
    console.log(`   Inactive users: ${inactiveUsers}`);
    
    if (inactiveUsers === 0) {
      console.log('\n⚠️  Database query shows 0 inactive users, but let\'s double-check...');
      
      // Let's explicitly query and check a few sample users
      const sampleInactive = await User.find({ isActive: false }).limit(5).select('username loginid isActive');
      if (sampleInactive.length > 0) {
        console.log('\n❗ Found inactive users despite count being 0:');
        sampleInactive.forEach(user => {
          console.log(`   - ${user.username} (${user.loginid}): isActive = ${user.isActive}`);
        });
      } else {
        console.log('\n✅ Confirmed: All users are already active!');
        return;
      }
    }
    
    console.log('\n🔄 Activating all inactive users...');
    
    // Update all inactive users to active
    const result = await User.updateMany(
      { isActive: false }, // Find all inactive users
      { 
        isActive: true,
        updatedBy: 'system-activation'
      }
    );
    
    console.log(`\n✅ Successfully activated ${result.modifiedCount} users!`);
    
    // Verify the changes
    console.log('\n📊 Verifying changes...');
    const newActiveCount = await User.countDocuments({ isActive: true });
    const newInactiveCount = await User.countDocuments({ isActive: false });
    
    console.log(`\n📈 Updated Status:`);
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Active users: ${newActiveCount}`);
    console.log(`   Inactive users: ${newInactiveCount}`);
    
    if (newInactiveCount === 0) {
      console.log('\n🎉 All users are now active and can login!');
    } else {
      console.log(`\n⚠️  Warning: ${newInactiveCount} users are still inactive`);
    }
    
    console.log('\n📝 Sample of activated users:');
    const sampleUsers = await User.find({ isActive: true })
      .select('userid username loginid role isActive')
      .limit(5)
      .sort({ updatedAt: -1 });
    
    sampleUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.username} (${user.loginid}) - ${user.role}`);
    });
    
  } catch (error) {
    console.error('❌ Error activating users:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the activation
console.log('🚀 Starting user activation process...');
activateAllUsers();