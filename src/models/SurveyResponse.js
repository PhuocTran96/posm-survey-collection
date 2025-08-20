const mongoose = require('mongoose');

const surveyResponseSchema = new mongoose.Schema({
  leader: {
    type: String,
    required: true
  },
  shopName: {
    type: String,
    required: true
  },
  responses: [{
    model: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    posmSelections: [{
      posmCode: String,
      posmName: String,
      selected: Boolean
    }],
    allSelected: {
      type: Boolean,
      default: false
    },
    images: [{
      type: String
    }]
  }],
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);