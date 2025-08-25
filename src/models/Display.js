const mongoose = require('mongoose');

const displaySchema = new mongoose.Schema({
  store_id: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  model: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  is_displayed: {
    type: Boolean,
    required: true,
    default: false
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  updatedBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
displaySchema.index({ store_id: 1 });
displaySchema.index({ model: 1 });
displaySchema.index({ is_displayed: 1 });
displaySchema.index({ store_id: 1, model: 1 }, { unique: true }); // Composite unique index

// Prevent duplicate store_id + model combinations
displaySchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('store_id') || this.isModified('model')) {
    const existingDisplay = await this.constructor.findOne({
      store_id: this.store_id,
      model: this.model,
      _id: { $ne: this._id }
    });

    if (existingDisplay) {
      return next(new Error(`Display record for store ${this.store_id} and model ${this.model} already exists`));
    }
  }
  next();
});

const Display = mongoose.model('Display', displaySchema);

module.exports = Display;