import "./src/config/loadEnv.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { connectDB } from "./src/config/db.js";
import { getJwtSecret } from "./src/config/jwtSecret.js";
import apiRoutes from "./src/routes/apiRoutes.js";
import {
  classifierInfo,
  initModelFromNasa,
} from "./src/services/nasaPowerService.js";

export function buildStatusPayload() {
  const classifier = classifierInfo();
  return {
    status: "online",
    project: "Field Shift: Adapting Farms with NASA Data",
    database: "MongoDB with Mongoose",
    engine: classifier.description,
    classifier,
    publicDemo: {
      latLng: "/api/public/assess?lat={lat}&lng={lng}",
      region: "/api/public/assess?region={name}",
      note: "No account required. Rate limited per IP.",
    },
  };
}

export function createApp({ log = true } = {}) {
  const app = express();
  // Render terminates TLS and forwards the client address in one hop.
  app.set("trust proxy", 1);
  if (log) app.use(morgan("dev"));
  app.use(cors());
  app.use(express.json());
  app.use("/api", apiRoutes);
  app.get("/", (req, res) => {
    res.json(buildStatusPayload());
  });
  return app;
}

const PORT = process.env.PORT || 5000;

async function startApp() {
  try {
    // Fail here when production has no JWT_SECRET. A secret already set on
    // Render is used as-is. Local development gets an ephemeral secret.
    getJwtSecret();

    console.log("Connecting to database...");
    await connectDB();

    console.log("Loading NASA POWER reference hubs for the k-NN classifier...");
    await initModelFromNasa();

    const app = createApp();
    app.listen(PORT, () => {
      console.log(`Field Shift backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server failed during startup:", error.message);
    process.exit(1);
  }
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  startApp();
}
