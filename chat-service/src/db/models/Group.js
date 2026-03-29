// ============================================================
//  Group Model
//
//  Indexes:
//    members → find all groups a user belongs to
//    created_by → find groups created by a user
// ============================================================

const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
    {
        name: {
            type: String, required: true,
            trim: true, minlength: 1, maxlength: 100,
        },
        description: { type: String, default: "", maxlength: 500 },
        avatar_url: { type: String, default: null },
        created_by: { type: String, required: true },

        members: [
            {
                user_id: { type: String, required: true },
                role: { type: String, enum: ["admin", "member"], default: "member" },
                joined_at: { type: Date, default: Date.now },
            },
        ],

        // Last message preview (avoids querying messages for chat list)
        last_message: {
            content: String,
            sender_id: String,
            sent_at: Date,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

groupSchema.index({ "members.user_id": 1 });
groupSchema.index({ created_by: 1 });

// Get all groups a user is member of
groupSchema.statics.getForUser = function (userId) {
    return this.find({ "members.user_id": userId }).lean();
};

// Add a member
groupSchema.methods.addMember = function (userId) {
    const exists = this.members.some(m => m.user_id === userId);
    if (!exists) {
        this.members.push({ user_id: userId });
    }
    return this.save();
};

// Remove a member
groupSchema.methods.removeMember = function (userId) {
    this.members = this.members.filter(m => m.user_id !== userId);
    return this.save();
};

module.exports = mongoose.model("Group", groupSchema);