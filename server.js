import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db.js";
import apiRoutes from "./src/routes/apiRoutes.js";
import morgan from 'morgan'; 
// 1. IMPORT YOUR TRAINED ML MODULE ENGINE HERE
import { initModelFromNasa } from "./src/services/nasaPowerService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({
    status: "online",
    project: "Field Shift: Adapting Farms with NASA Data",
    database: "MongoDB with Mongoose",
    engine: "ml-cart in-memory tree fully optimized",
  });
});

// 2. WRAP BOOT SEQUENCE IN AN ASYNC FUNCTION TO ENSURE DATA LIFTCYCLE LOADS IN ORDER
async function startApp() {
  try {
    // Phase A: Establish your MongoDB cloud cluster connections
    console.log("🗄️ Connecting to local database/cloud instance...");
    await connectDB();

    // Phase B: Fetch NASA data and compile your decision tree rules right into memory
    console.log("🧠 Triggering Machine Learning model compilation loop...");
    await initModelFromNasa();

    // Phase C: Open up ports for traffic once everything is successfully calibrated
    app.listen(PORT, () => {
      console.log(`🚀 Field Shift backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(
      "🛑 Server pipeline crashed on boot execution:",
      error.message,
    );
    process.exit(1);
  }
}

// 3. EXECUTE REBOOT ENGINE RUNTIME
startApp();
