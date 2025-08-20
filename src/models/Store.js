const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  province: {
    type: String,
    required: true
  },
  leader: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Store', storeSchema);