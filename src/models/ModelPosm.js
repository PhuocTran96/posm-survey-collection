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

module.exports = mongoose.model('ModelPosm', modelPosmSchema);
