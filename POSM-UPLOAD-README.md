# POSM Data Upload Script

This script uploads POSM (Point of Sale Materials) data from a CSV file to MongoDB.

## Files Created

1. **`upload-posm-data.js`** - Main Node.js script
2. **`upload-posm.bat`** - Windows batch file for easy execution
3. **Package.json scripts** - Added npm commands for convenience

## Usage Options

### Option 1: Using the Windows Batch File (Easiest)
```bash
# Double-click upload-posm.bat or run in command prompt
upload-posm.bat
```

### Option 2: Using NPM Scripts
```bash
# Upsert POSM data (add new + update existing) [RECOMMENDED]
npm run upload-posm-upsert

# Insert new records only (skip existing)
npm run upload-posm-insert

# Update existing records only
npm run upload-posm-update

# Clear existing data and upsert
npm run upload-posm-clear
```

### Option 3: Direct Node.js Execution
```bash
# Upsert mode (default) - add new and update existing
node upload-posm-data.js

# Upsert from specific file
node upload-posm-data.js posm.csv --upsert

# Insert only mode - traditional behavior
node upload-posm-data.js --insert-only

# Update only mode - only update existing records
node upload-posm-data.js --update-only

# Clear existing data and upsert
node upload-posm-data.js --clear --upsert

# Show help
node upload-posm-data.js --help
```

## CSV File Format

The script expects a CSV file with the following columns:

```csv
model,posm,posm_name
EWF9023P5WC,CARE_W5002,Sticker Máy giặt UC3  500
EWF9023P5WC,CARE_NEW,Sticker Mới UC3
EWF9023P5WC,CARE_TL,Sticker Made in Thailand UC3
...
```

### Required Columns:
- **model**: Product model code (e.g., EWF9023P5WC)
- **posm**: POSM code (e.g., CARE_W5002)
- **posm_name**: POSM display name (e.g., Sticker Máy giặt UC3  500)

## Features

- ✅ **Smart Upsert Mode**: Creates new records AND updates existing ones (RECOMMENDED)
- ✅ **Insert-Only Mode**: Traditional behavior - adds new records, skips existing
- ✅ **Update-Only Mode**: Only updates existing records, doesn't create new ones
- ✅ **Batch Processing**: Uploads data in batches of 100 records for efficiency
- ✅ **Duplicate Detection**: Automatically handles duplicate records
- ✅ **Error Handling**: Continues processing even if some records fail
- ✅ **Progress Tracking**: Shows real-time upload progress with detailed statistics
- ✅ **Data Validation**: Validates required fields before upload
- ✅ **Clear Option**: Can clear existing data before upload

## Prerequisites

1. **Node.js** installed on your system
2. **MongoDB connection** configured in `.env` file
3. **CSV file** (`posm.csv`) in the project directory

## Environment Setup

Make sure your `.env` file contains:
```
MONGODB_URI=your_mongodb_connection_string
```

## Update Modes

### 🔄 **Upsert Mode (Default & Recommended)**
```bash
node upload-posm-data.js --upsert
```
- **Creates new records** if they don't exist
- **Updates existing records** if they already exist
- **Best for regular data sync** and maintaining data freshness

### ➕ **Insert-Only Mode**
```bash
node upload-posm-data.js --insert-only
```
- **Only adds new records**
- **Skips existing records** (traditional behavior)
- **Best for initial data loading** or adding supplementary data

### 🔄 **Update-Only Mode**
```bash
node upload-posm-data.js --update-only
```
- **Only updates existing records**
- **Does not create new records**
- **Best for bulk updates** to existing POSM information

## Example Output

### Upsert Mode Output:
```
🚀 POSM Data Upload Script
==========================
📂 CSV File: posm.csv
🧹 Clear existing: No
🔄 Update mode: upsert
📦 Batch size: 100
🔍 Skip duplicates: Yes

✅ MongoDB Connected: cluster0-shard-00-02.mongodb.net
📊 Database: posm_survey
📂 Reading CSV file: posm.csv
✅ CSV parsing completed: 388 valid records found
🔍 Checking for duplicates...
💾 Uploading 388 records to MongoDB using upsert mode...
✅ Batch 1: 5 new, 95 updated
✅ Batch 2: 8 new, 92 updated
✅ Batch 3: 12 new, 88 updated
✅ Batch 4: 3 new, 85 updated

📊 Upload Summary:
✅ New records created: 28
🔄 Existing records updated: 360
📝 Total processed: 388

📈 Database Statistics:
   Total POSM records: 1,147
   Unique models: 145

🎉 POSM data upload completed successfully!
📤 MongoDB connection closed
```

## Troubleshooting

### Common Issues:

1. **"CSV file not found"**
   - Make sure `posm.csv` is in the same directory as the script
   - Or provide the full path to your CSV file

2. **"MongoDB connection error"**
   - Check your `.env` file has the correct `MONGODB_URI`
   - Ensure your MongoDB cluster is running and accessible

3. **"Missing required fields"**
   - Verify your CSV has the correct column headers: `model`, `posm`, `posm_name`
   - Check for empty rows or missing data

4. **Duplicate key errors**
   - The script automatically handles duplicates
   - Use `--clear` option if you want to replace existing data

## MongoDB Schema

The script creates documents with this structure:

```javascript
{
  model: String,      // Product model code
  posm: String,       // POSM code  
  posmName: String,   // POSM display name
  createdAt: Date,    // Auto-generated timestamp
  updatedAt: Date     // Auto-generated timestamp
}
```

## Support

If you encounter any issues:

1. Check the console output for specific error messages
2. Verify your CSV file format matches the expected structure
3. Ensure MongoDB connection is working
4. Run with `--help` flag to see all available options
