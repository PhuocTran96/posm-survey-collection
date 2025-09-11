const mongoose = require('mongoose');

const modelPosmSchema = new mongoose.Schema(
  {
    model: {
      type: String,
      required: true,
    },
    posm: {
      type: String,
      required: true,
    },
    posmName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: false,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Add case-insensitive index for model field to improve query performance
modelPosmSchema.index(
  {
    model: 1,
  },
  {
    collation: { locale: 'en', strength: 2 }, // Case-insensitive collation
  }
);

module.exports = mongoose.model('ModelPosm', modelPosmSchema);
