import mongoose from "mongoose";

const farmSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    locationName: { type: String, default: "Primary Agro-Field" },
    lat: { type: Number, default: 5.6037 },
    lng: { type: Number, default: -0.187 },
    currentCrop: { type: String, default: "Maize" },
    fieldSize: { type: Number, default: 2.5 }, // Hectares
  },
  { timestamps: true },
);

export default mongoose.model("Farm", farmSchema);
