import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import jwt from "jsonwebtoken";
import {
  getJwtSecret,
  resetJwtSecretCache,
  resolveJwtSecret,
} from "../src/config/jwtSecret.js";

const failures = [];

function check(name, condition, detail) {
  if (condition) {
    console.log(`ok  ${name}`);
    return;
  }
  failures.push(name);
  console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
}

function listJs(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listJs(path));
    else if (name.endsWith(".js")) files.push(path);
  }
  return files;
}

const configured = resolveJwtSecret({
  NODE_ENV: "production",
  JWT_SECRET: "render-configured-secret",
});
check(
  "A configured JWT_SECRET is used unchanged in production",
  configured.ephemeral === false && configured.secret === "render-configured-secret",
  configured.secret,
);

let missingProduction = null;
try {
  resolveJwtSecret({ NODE_ENV: "production" });
} catch (error) {
  missingProduction = error;
}
check(
  "Production refuses to boot without JWT_SECRET",
  missingProduction?.code === "JWT_SECRET_MISSING" &&
    /JWT_SECRET is required in production/.test(missingProduction.message) &&
    !/fallback_secret/.test(missingProduction.message),
  missingProduction?.message,
);

const blankProduction = (() => {
  try {
    resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: "   " });
    return null;
  } catch (error) {
    return error;
  }
})();
check(
  "A blank JWT_SECRET is treated as missing in production",
  blankProduction?.code === "JWT_SECRET_MISSING",
);

const devA = resolveJwtSecret({ NODE_ENV: "development" });
const devB = resolveJwtSecret({ NODE_ENV: "development" });
check(
  "Development without JWT_SECRET gets an ephemeral secret",
  devA.ephemeral === true &&
    devB.ephemeral === true &&
    /^[a-f0-9]{64}$/.test(devA.secret) &&
    devA.secret !== devB.secret &&
    devA.secret !== "fallback_secret",
);

const savedSecret = process.env.JWT_SECRET;
const savedNodeEnv = process.env.NODE_ENV;
delete process.env.JWT_SECRET;
process.env.NODE_ENV = "development";
resetJwtSecretCache();
const warnings = [];
const originalWarn = console.warn;
console.warn = (...parts) => warnings.push(parts.join(" "));
let cachedA;
let cachedB;
try {
  cachedA = getJwtSecret();
  cachedB = getJwtSecret();
} finally {
  console.warn = originalWarn;
  if (savedSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedSecret;
  if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedNodeEnv;
  resetJwtSecretCache();
}
const warningText = warnings.join("\n");
check(
  "The dev fallback warns once and does not print the secret",
  cachedA === cachedB &&
    /^[a-f0-9]{64}$/.test(cachedA) &&
    warnings.length > 0 &&
    /JWT_SECRET is not set/.test(warningText) &&
    /ephemeral/.test(warningText) &&
    /local development only/.test(warningText) &&
    !warningText.includes(cachedA),
  warningText,
);

const signed = jwt.sign({ userId: "judge" }, configured.secret);
check(
  "Tokens sign and verify with the configured secret",
  jwt.verify(signed, "render-configured-secret").userId === "judge",
);

const roots = ["server.js", ...listJs("src"), "package.json"];
const banned = /fallback_secret|ml-cart|16-Hub|decision tree|Dynamic Leaf Assessment/i;
const hits = [];
for (const path of roots) {
  const text = readFileSync(path, "utf8");
  if (banned.test(text)) hits.push(path);
}
check(
  "Source and package.json no longer claim ml-cart, a 16-hub tree, or a default JWT secret",
  hits.length === 0,
  hits.join(", "),
);

if (failures.length) {
  console.error(`\n${failures.length} JWT check(s) failed.`);
  process.exit(1);
}
console.log("\nAll JWT checks passed.");
