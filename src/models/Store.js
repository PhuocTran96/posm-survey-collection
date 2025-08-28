const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    store_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    store_code: {
      type: String,
      trim: true,
      index: true,
    },
    store_name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    channel: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    hc: {
      type: Number,
      required: true,
      min: 0,
    },
    region: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    province: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    mcp: {
      type: String,
      required: true,
      trim: true,
      enum: ['Y', 'N'],
      default: 'N',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      default: 'system',
    },
    updatedBy: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for performance
storeSchema.index({ store_id: 1 });
storeSchema.index({ store_code: 1 });
storeSchema.index({ store_name: 1 });
storeSchema.index({ channel: 1 });
storeSchema.index({ region: 1 });
storeSchema.index({ province: 1 });
storeSchema.index({ isActive: 1 });

// Compound indexes for common queries
storeSchema.index({ region: 1, province: 1 });
storeSchema.index({ channel: 1, region: 1 });

module.exports = mongoose.model('Store', storeSchema);
