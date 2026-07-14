const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^01[3-9]\d{8}$/, 'Invalid Bangladeshi phone number'],
    },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

// Hash password when a virtual `password` is set
userSchema.virtual('password').set(function (plain) {
  this._password = plain;
});

// Hash before validation so the required passwordHash is present when validators run
userSchema.pre('validate', async function (next) {
  if (this._password) {
    this.passwordHash = await bcrypt.hash(this._password, 10);
  }
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never leak the hash
userSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    address: this.address,
  };
};

module.exports = mongoose.model('User', userSchema);
