const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String, required: true, unique: true,  // unique:true creates the index
            trim: true, minlength: 2, maxlength: 30,
            match: /^[a-zA-Z0-9_]+$/,
        },
        email: {
            type: String, required: true, unique: true,  // unique:true creates the index
            lowercase: true, trim: true,
        },
        password_hash: {
            type: String, required: true,
            select: false,
        },
        avatar_url: { type: String, default: null },
        is_online: { type: Boolean, default: false },
        last_seen: { type: Date, default: Date.now },
        push_tokens: [{
            token: String,
            platform: { type: String, enum: ["ios", "android", "web"] },
            created_at: { type: Date, default: Date.now },
        }],
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
        toJSON: {
            transform(doc, ret) {
                delete ret.password_hash;
                return ret;
            },
        },
    }
);

// Only this index — email and username indexes come from unique:true above
userSchema.index({ last_seen: -1 });

userSchema.pre("save", async function (next) {
    if (!this.isModified("password_hash")) return next();
    this.password_hash = await bcrypt.hash(this.password_hash, 12);
    next();
});

userSchema.methods.verifyPassword = async function (plain) {
    return bcrypt.compare(plain, this.password_hash);
};

userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase() }).select("+password_hash");
};

module.exports = mongoose.model("User", userSchema);