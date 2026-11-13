import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    name: { type: String, required: true },
    AgriculturalRegion: { type: String, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
