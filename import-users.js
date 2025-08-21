#!/usr/bin/env node

/**
 * User CSV Import Script
 * 
 * This script imports users from a CSV file into MongoDB.
 * CSV format: userid,username,loginid,password,role,leader
 * 
 * Usage:
 *   node import-users.js <csv-file-path> [options]
 * 
 * Options:
 *   --clear      Clear all existing users before import (except super admin)
 *   --update     Update existing users if they exist
 *   --skip-existing  Skip existing users (default behavior)
 *   --create-super-admin  Create default super admin account
 * 
 * Examples:
 *   node import-users.js users.csv
 *   node import-users.js users.csv --clear
 *   node import-users.js users.csv --update
 *   node import-users.js --create-super-admin
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const { User } = require('./src/models');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/posm-survey';
const DEFAULT_SUPER_ADMIN = {
  userid: 'SUPER001',
  username: 'superadmin',
  loginid: 'admin',
  password: 'Admin@123',
  role: 'admin'
};

class UserImporter {
  constructor() {
    this.stats = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    };
    this.options = {
      clear: false,
      update: false,
      skipExisting: true,
      createSuperAdmin: false
    };
  }

  async connect() {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      process.exit(1);
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }

  parseArguments() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      this.showHelp();
      process.exit(0);
    }

    if (args.includes('--create-super-admin')) {
      this.options.createSuperAdmin = true;
      return;
    }

    if (args.length === 0) {
      console.error('❌ Please provide a CSV file path or use --create-super-admin');
      this.showHelp();
      process.exit(1);
    }

    this.csvFilePath = args[0];
    this.options.clear = args.includes('--clear');
    this.options.update = args.includes('--update');
    this.options.skipExisting = !this.options.update;

    if (!fs.existsSync(this.csvFilePath)) {
      console.error(`❌ CSV file not found: ${this.csvFilePath}`);
      process.exit(1);
    }
  }

  showHelp() {
    console.log(`
📋 User CSV Import Script

Usage:
  node import-users.js <csv-file-path> [options]
  node import-users.js --create-super-admin

CSV Format:
  userid,username,loginid,password,role,leader

Options:
  --clear              Clear all existing users before import (except super admin)
  --update             Update existing users if they exist
  --skip-existing      Skip existing users (default behavior)
  --create-super-admin Create default super admin account
  --help, -h           Show this help message

Examples:
  node import-users.js users.csv
  node import-users.js users.csv --clear
  node import-users.js users.csv --update
  node import-users.js --create-super-admin

CSV Example:
  userid,username,loginid,password,role,leader
  EMP001,john.doe,johndoe,SecurePass123,user,
  EMP002,jane.smith,janesmith,SecurePass456,PRT,john.doe
  EMP003,manager.one,manager1,ManagerPass789,TDS,
    `);
  }

  async createSuperAdmin() {
    try {
      console.log('🔧 Creating super admin account...');
      
      const existingSuperAdmin = await User.findOne({ isSuperAdmin: true });
      if (existingSuperAdmin) {
        console.log('ℹ️ Super admin already exists:', existingSuperAdmin.username);
        return;
      }

      const superAdmin = await User.createSuperAdmin(DEFAULT_SUPER_ADMIN);

      console.log('✅ Super admin created successfully');
      console.log(`   Username: ${superAdmin.username}`);
      console.log(`   Login ID: ${superAdmin.loginid}`);
      console.log(`   Password: ${DEFAULT_SUPER_ADMIN.password}`);
      console.log('⚠️ Please change the default password after first login!');
      
    } catch (error) {
      console.error('❌ Failed to create super admin:', error.message);
      throw error;
    }
  }

  async clearExistingUsers() {
    if (!this.options.clear) return;
    
    console.log('🗑️ Clearing existing users (except super admin)...');
    
    const result = await User.deleteMany({ isSuperAdmin: { $ne: true } });
    console.log(`   Deleted ${result.deletedCount} users`);
  }

  validateUserData(userData, lineNumber) {
    const errors = [];
    
    if (!userData.userid?.trim()) {
      errors.push('userid is required');
    }
    
    if (!userData.username?.trim()) {
      errors.push('username is required');
    }
    
    if (!userData.loginid?.trim()) {
      errors.push('loginid is required');
    }
    
    if (!userData.password?.trim()) {
      errors.push('password is required');
    } else if (userData.password.length < 6) {
      errors.push('password must be at least 6 characters');
    }
    
    if (!userData.role?.trim()) {
      errors.push('role is required');
    } else if (!['admin', 'user', 'PRT', 'TDS', 'TDL'].includes(userData.role)) {
      errors.push('invalid role. Must be: admin, user, PRT, TDS, or TDL');
    }
    
    // Note: Hierarchy validation will be done during user creation
    
    if (errors.length > 0) {
      this.stats.errors++;
      this.stats.errorDetails.push({
        line: lineNumber,
        userid: userData.userid,
        errors: errors
      });
      return false;
    }
    
    return true;
  }

  async processUser(userData, lineNumber) {
    try {
      if (!this.validateUserData(userData, lineNumber)) {
        return;
      }

      // Clean and prepare data
      const cleanUserData = {
        userid: userData.userid.trim(),
        username: userData.username.trim(),
        loginid: userData.loginid.trim(),
        password: userData.password.trim(),
        role: userData.role.trim(),
        leader: userData.leader?.trim() || null,
        createdBy: 'csv-import',
        updatedBy: 'csv-import'
      };

      // Check if user exists
      const existingUser = await User.findOne({
        $or: [
          { userid: cleanUserData.userid },
          { username: cleanUserData.username },
          { loginid: cleanUserData.loginid }
        ]
      });

      if (existingUser) {
        if (this.options.update) {
          // Update existing user
          Object.assign(existingUser, cleanUserData);
          existingUser.updatedBy = 'csv-import';
          await existingUser.save();
          
          this.stats.updated++;
          console.log(`📝 Updated: ${cleanUserData.username}`);
        } else {
          // Skip existing user
          this.stats.skipped++;
          console.log(`⏭️ Skipped (exists): ${cleanUserData.username}`);
        }
      } else {
        // Create new user
        const newUser = new User(cleanUserData);
        await newUser.save();
        
        this.stats.created++;
        console.log(`✅ Created: ${cleanUserData.username}`);
      }

    } catch (error) {
      this.stats.errors++;
      this.stats.errorDetails.push({
        line: lineNumber,
        userid: userData.userid,
        errors: [error.message]
      });
      console.error(`❌ Error processing user ${userData.username}: ${error.message}`);
    }
  }

  async importFromCSV() {
    const users = [];
    
    return new Promise((resolve, reject) => {
      let lineNumber = 1; // Start from 1 (header)
      
      console.log(`📂 Reading CSV file: ${this.csvFilePath}`);
      
      fs.createReadStream(this.csvFilePath)
        .pipe(csv())
        .on('data', (data) => {
          lineNumber++;
          this.stats.total++;
          users.push({ ...data, lineNumber });
        })
        .on('end', async () => {
          // Process users sequentially to avoid database connection issues
          for (const userData of users) {
            await this.processUser(userData, userData.lineNumber);
          }
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  printSummary() {
    console.log('\n📊 Import Summary:');
    console.log(`   Total rows processed: ${this.stats.total}`);
    console.log(`   Users created: ${this.stats.created}`);
    console.log(`   Users updated: ${this.stats.updated}`);
    console.log(`   Users skipped: ${this.stats.skipped}`);
    console.log(`   Errors: ${this.stats.errors}`);
    
    if (this.stats.errorDetails.length > 0) {
      console.log('\n❌ Error Details:');
      this.stats.errorDetails.forEach(error => {
        console.log(`   Line ${error.line} (${error.userid}): ${error.errors.join(', ')}`);
      });
    }
    
    if (this.stats.errors === 0) {
      console.log('\n🎉 Import completed successfully!');
    } else {
      console.log('\n⚠️ Import completed with errors. Please review the error details above.');
    }
  }

  async run() {
    try {
      await this.connect();
      
      if (this.options.createSuperAdmin) {
        await this.createSuperAdmin();
      } else {
        await this.clearExistingUsers();
        await this.importFromCSV();
        this.printSummary();
      }
      
    } catch (error) {
      console.error('❌ Import failed:', error.message);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run the script
if (require.main === module) {
  const importer = new UserImporter();
  importer.parseArguments();
  importer.run();
}

module.exports = UserImporter;