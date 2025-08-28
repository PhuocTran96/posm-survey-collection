# Claude Notes

This file stores useful outputs/snippets from Claude Code for reuse.

---

## UTF-8 BOM Fix for CSV Parsing (2025-08-28)

### Problem
CSV files saved in "UTF-8 with BOM" (UTF-8 SIG) encoding were not being parsed correctly. The system would fail to recognize the first column header due to the Byte Order Mark (BOM) bytes `EF BB BF` being included in the parsed data.

### Solution
Modified the `parseCSVFromBuffer` function in `src/controllers/dataUploadController.js` to automatically detect and strip UTF-8 BOM before parsing.

```js
// Helper function to parse CSV from buffer with BOM handling
const parseCSVFromBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = require('stream');
    
    // Strip UTF-8 BOM if present (0xEF, 0xBB, 0xBF)
    let cleanBuffer = buffer;
    if (buffer.length >= 3 && 
        buffer[0] === 0xEF && 
        buffer[1] === 0xBB && 
        buffer[2] === 0xBF) {
      cleanBuffer = buffer.slice(3);
      console.log('🔧 UTF-8 BOM detected and stripped from CSV file');
    }
    
    const readable = new stream.Readable();
    readable.push(cleanBuffer);
    readable.push(null);

    readable
      .pipe(csv({ skipEmptyLines: true }))
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};
```

### Files Modified
- `src/controllers/dataUploadController.js:23-54` - Added BOM detection and stripping
- `src/controllers/dataUploadController.js:94` - Removed old BOM fallback handling for stores
- `src/controllers/dataUploadController.js:264` - Removed old BOM fallback handling for POSM

### Testing Results
✅ Normal UTF-8 CSV files: Parse and upload successfully  
✅ UTF-8 BOM CSV files: BOM detected, stripped, then parse and upload successfully

### Technical Details
- UTF-8 BOM consists of bytes `0xEF 0xBB 0xBF` at the start of the file
- BOM is automatically added by some text editors (Excel, Notepad) when saving as "UTF-8 with BOM"
- Previous implementation had partial handling with fallback column names like `row['﻿store_id']`
- New implementation handles BOM at the buffer level before CSV parsing begins
- Maintains backward compatibility with normal UTF-8 files

---