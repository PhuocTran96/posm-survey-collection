const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Import models
require('dotenv').config();
const User = require('./src/models/User');
const { connectDB } = require('./src/config/database');

async function fixLoginIssues() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    
    console.log('🔍 Checking login issues...');
    
    // 1. Fix admin role case sensitivity
    console.log('\n1. Fixing admin role case sensitivity...');
    const adminUsers = await User.find({ role: 'Admin' });
    console.log(`Found ${adminUsers.length} users with "Admin" role (uppercase)`);
    
    for (const user of adminUsers) {
      await User.findByIdAndUpdate(user._id, { 
        role: 'admin',
        updatedBy: 'system-fix'
      });
      console.log(`✅ Fixed role for ${user.username}: Admin -> admin`);
    }
    
    // 2. Create/update test admin user with known password
    console.log('\n2. Creating test admin user...');
    const testAdminLoginId = 'admin';
    const testAdminPassword = 'admin123';
    
    let testAdmin = await User.findOne({ loginid: testAdminLoginId });
    
    if (testAdmin) {
      // Update existing user
      const hashedPassword = await bcrypt.hash(testAdminPassword, 12);
      await User.findByIdAndUpdate(testAdmin._id, {
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        isSuperAdmin: true,
        updatedBy: 'system-fix'
      });
      console.log(`✅ Updated existing admin user: ${testAdminLoginId}`);
    } else {
      // Create new admin user
      const newAdmin = new User({
        userid: 'ADMIN001',
        username: 'System Administrator',
        loginid: testAdminLoginId,
        password: testAdminPassword,
        role: 'admin',
        isActive: true,
        isSuperAdmin: true,
        leader: null,
        createdBy: 'system-fix'
      });
      
      await newAdmin.save();
      console.log(`✅ Created new admin user: ${testAdminLoginId}`);
    }
    
    // 3. Create test regular user
    console.log('\n3. Creating test regular user...');
    const testUserLoginId = 'testuser';
    const testUserPassword = 'test123';
    
    let testUser = await User.findOne({ loginid: testUserLoginId });
    
    if (testUser) {
      // Update existing user
      const hashedPassword = await bcrypt.hash(testUserPassword, 12);
      await User.findByIdAndUpdate(testUser._id, {
        password: hashedPassword,
        isActive: true,
        updatedBy: 'system-fix'
      });
      console.log(`✅ Updated existing test user: ${testUserLoginId}`);
    } else {
      // Find a TDS or TDL user to be the leader
      const leader = await User.findOne({ role: { $in: ['TDS', 'TDL'] } });
      
      const newUser = new User({
        userid: 'TEST001',
        username: 'Test User',
        loginid: testUserLoginId,
        password: testUserPassword,
        role: 'user',
        isActive: true,
        leader: leader ? leader.username : null,
        createdBy: 'system-fix'
      });
      
      await newUser.save();
      console.log(`✅ Created new test user: ${testUserLoginId}`);
    }
    
    // 4. Set default password for existing users (optional - commented out for security)
    /*
    console.log('\n4. Setting default password for existing users...');
    const defaultPassword = '123456';
    const hashedDefault = await bcrypt.hash(defaultPassword, 12);
    
    const result = await User.updateMany(
      { role: { $ne: 'admin' } },
      { 
        password: hashedDefault,
        updatedBy: 'system-fix'
      }
    );
    console.log(`✅ Updated password for ${result.modifiedCount} users`);
    */
    
    console.log('\n🎉 Login issues fixed successfully!');
    console.log('\n📝 Test Credentials:');
    console.log('Admin Login:');
    console.log('  - URL: http://localhost:3000/admin-login.html');
    console.log('  - Login ID: admin');
    console.log('  - Password: admin123');
    console.log('\nRegular User Login:');
    console.log('  - URL: http://localhost:3000/login.html');
    console.log('  - Login ID: testuser');
    console.log('  - Password: test123');
    
  } catch (error) {
    console.error('❌ Error fixing login issues:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

fixLoginIssues();