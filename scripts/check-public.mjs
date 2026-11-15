import apiRoutes from "../src/routes/apiRoutes.js";
import { initModelFromBaselines } from "../src/services/nasaPowerService.js";
import { resetPublicRateLimit } from "../src/middleware/publicRateLimit.js";
import { createApp } from "../server.js";

const KUMASI = { lat: 6.6885, lng: -1.6244 };
const TAMALE = { lat: 9.4072, lng: -0.8532 };
const IOWA = { lat: 41.5868, lng: -93.625 };
const KUMASI_CLIMATE = { avgTemp: 26.5, totalRain: 1500, avgSolar: 4.8 };
const TAMALE_CLIMATE = { avgTemp: 30.2, totalRain: 950, avgSolar: 5.8 };
const IOWA_CLIMATE = { avgTemp: 10.2, totalRain: 914, avgSolar: 3.6 };
const YEAR = new Date().getUTCFullYear() - 1;

const failures = [];
const nasaCalls = [];
const nominatimCalls = [];

function check(name, condition, detail) {
  if (condition) {
    console.log(`ok  ${name}`);
    return;
  }
  failures.push(name);
  console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
}

function nasaBody(climate) {
  const T2M = {};
  const PRECTOTCORR = {};
  const ALLSKY_SFC_SW_DWN = {};
  for (let day = 1; day <= 5; day += 1) {
    const key = `202501${String(day).padStart(2, "0")}`;
    T2M[key] = climate.avgTemp;
    PRECTOTCORR[key] = climate.totalRain / 365;
    ALLSKY_SFC_SW_DWN[key] = climate.avgSolar;
  }
  return { properties: { parameter: { T2M, PRECTOTCORR, ALLSKY_SFC_SW_DWN } } };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (url, options) => {
  const href = String(url);
  if (href.startsWith("http://127.0.0.1") || href.startsWith("http://localhost")) {
    return realFetch(url, options);
  }
  if (href.includes("power.larc.nasa.gov")) {
    nasaCalls.push(href);
    const parsed = new URL(href);
    const lat = Number(parsed.searchParams.get("latitude"));
    let climate = KUMASI_CLIMATE;
    if (Math.abs(lat - IOWA.lat) < 1) climate = IOWA_CLIMATE;
    else if (Math.abs(lat - TAMALE.lat) < 0.05) climate = TAMALE_CLIMATE;
    return jsonResponse(nasaBody(climate));
  }
  if (href.includes("nominatim.openstreetmap.org")) {
    nominatimCalls.push(href);
    const query = new URL(href).searchParams.get("q") || "";
    if (/kumasi/i.test(query)) {
      return jsonResponse([
        {
          lat: String(KUMASI.lat),
          lon: String(KUMASI.lng),
          display_name: "Kumasi, Ashanti, Ghana",
        },
      ]);
    }
    if (/tamale/i.test(query)) {
      return jsonResponse([
        {
          lat: String(TAMALE.lat),
          lon: String(TAMALE.lng),
          display_name: "Tamale, Northern, Ghana",
        },
      ]);
    }
    return jsonResponse([]);
  }
  if (href.includes("openweathermap.org")) {
    return jsonResponse({
      name: "Kumasi",
      main: { temp: 28, feels_like: 30, humidity: 70, pressure: 1012 },
      clouds: { all: 10 },
      wind: { speed: 2 },
      weather: [{ main: "Clouds", description: "scattered clouds" }],
    });
  }
  throw new Error(`Unexpected network call: ${href}`);
};

function routeHandles(path, method) {
  const layer = apiRoutes.stack.find((entry) => {
    return entry.route?.path === path && entry.route.methods?.[method];
  });
  return layer ? layer.route.stack.map((step) => step.handle.name) : null;
}

initModelFromBaselines();
delete process.env.PUBLIC_ASSESS_RATE_LIMIT;
resetPublicRateLimit();
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "test-only-secret";

const app = createApp({ log: false });
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const { port } = server.address();

async function request(path, { method = "GET", headers = {} } = {}) {
  const res = await realFetch(`http://127.0.0.1:${port}${path}`, { method, headers });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text
  }
  return {
    status: res.status,
    body,
    retryAfter: res.headers.get("retry-after"),
  };
}

function assertNasaRequest(href, lat, lng, start, end) {
  if (!href) return false;
  const parsed = new URL(href);
  const parameters = parsed.searchParams.get("parameters") || "";
  return (
    parsed.pathname.endsWith("/api/temporal/daily/point") &&
    parsed.searchParams.get("community") === "AG" &&
    parsed.searchParams.get("format") === "JSON" &&
    parameters.includes("T2M") &&
    parameters.includes("PRECTOTCORR") &&
    parameters.includes("ALLSKY_SFC_SW_DWN") &&
    Number(parsed.searchParams.get("latitude")) === lat &&
    Number(parsed.searchParams.get("longitude")) === lng &&
    parsed.searchParams.get("start") === start &&
    parsed.searchParams.get("end") === end
  );
}

try {
  const publicHandles = routeHandles("/public/assess", "get");
  const protectedHandles = routeHandles("/climate-recommendations", "get");
  check(
    "Public route is rate limited and does not require a token",
    Array.isArray(publicHandles) &&
      publicHandles.includes("publicAssessRateLimit") &&
      publicHandles.includes("getPublicAssessment") &&
      !publicHandles.includes("verifyToken"),
    JSON.stringify(publicHandles),
  );
  check(
    "Authenticated climate route still requires a token",
    Array.isArray(protectedHandles) && protectedHandles.includes("verifyToken"),
    JSON.stringify(protectedHandles),
  );

  const beforeNasa = nasaCalls.length;
  const kumasi = await request(
    `/api/public/assess?lat=${KUMASI.lat}&lng=${KUMASI.lng}`,
  );
  const kumasiCall = nasaCalls[beforeNasa];
  check(
    "Lat/lng demo returns Kumasi's zone without a login",
    kumasi.status === 200 &&
      kumasi.body.success === true &&
      kumasi.body.supported === true &&
      kumasi.body.aiRecommendation?.zone === "Ashanti & Forest Zone" &&
      JSON.stringify(kumasi.body.recommendation) ===
        JSON.stringify(kumasi.body.aiRecommendation) &&
      kumasi.body.recommendation.crop === kumasi.body.recommendation.suggestedAdaptiveCrop &&
      kumasi.body.recommendation.model ===
        "k-NN (k=3) over 12 NASA POWER reference hubs" &&
      kumasi.body.recommendation.classifier?.k === 3 &&
      kumasi.body.recommendation.classifier?.referenceHubs === 12 &&
      kumasi.body.moisture?.annualRainfallMm === 1500 &&
      kumasi.body.provenance?.source === "NASA POWER" &&
      String(kumasi.body.dataSource).includes("NASA POWER"),
    JSON.stringify({
      status: kumasi.status,
      zone: kumasi.body.aiRecommendation?.zone,
      model: kumasi.body.recommendation?.model,
      rain: kumasi.body.moisture,
    }),
  );
  check(
    "Lat/lng demo calls the NASA POWER daily point API for those coordinates",
    nasaCalls.length === beforeNasa + 1 &&
      assertNasaRequest(
        kumasiCall,
        KUMASI.lat,
        KUMASI.lng,
        `${YEAR}0101`,
        `${YEAR}1231`,
      ),
    kumasiCall,
  );

  const beforeNominatim = nominatimCalls.length;
  const beforeRegionNasa = nasaCalls.length;
  const byRegion = await request("/api/public/assess?region=Tamale");
  check(
    "Region demo geocodes inside Ghana and runs the same assessment",
    byRegion.status === 200 &&
      byRegion.body.supported === true &&
      byRegion.body.aiRecommendation?.zone === "Northern Region Guinea Savannah" &&
      byRegion.body.location?.query === "Tamale" &&
      byRegion.body.location?.name === "Tamale, Northern, Ghana" &&
      byRegion.body.location?.coordinates?.lat === TAMALE.lat &&
      byRegion.body.moisture?.annualRainfallMm === 950 &&
      nominatimCalls.length === beforeNominatim + 1 &&
      new URL(nominatimCalls[beforeNominatim]).searchParams.get("countrycodes") === "gh" &&
      assertNasaRequest(
        nasaCalls[beforeRegionNasa],
        TAMALE.lat,
        TAMALE.lng,
        `${YEAR}0101`,
        `${YEAR}1231`,
      ),
    JSON.stringify({
      status: byRegion.status,
      zone: byRegion.body.aiRecommendation?.zone,
      location: byRegion.body.location,
    }),
  );

  const beforeBoth = nominatimCalls.length;
  const explicitCoords = await request(
    `/api/public/assess?lat=${KUMASI.lat}&lng=${KUMASI.lng}&region=NotAPlace`,
  );
  check(
    "Explicit coordinates are assessed even if region is also set",
    explicitCoords.status === 200 &&
      explicitCoords.body.supported === true &&
      explicitCoords.body.location?.query === "NotAPlace" &&
      nominatimCalls.length === beforeBoth,
    JSON.stringify({ status: explicitCoords.status, location: explicitCoords.body.location }),
  );

  const customWindow = await request(
    `/api/public/assess?lat=${KUMASI.lat}&lng=${KUMASI.lng}&start=20240101&end=20240630`,
  );
  const customCall = nasaCalls.at(-1);
  check(
    "Optional start and end are sent to NASA POWER",
    customWindow.status === 200 &&
      assertNasaRequest(customCall, KUMASI.lat, KUMASI.lng, "20240101", "20240630"),
    customCall,
  );

  const badDate = await request(
    `/api/public/assess?lat=${KUMASI.lat}&lng=${KUMASI.lng}&start=nope`,
  );
  const longRegion = await request(
    `/api/public/assess?region=${"A".repeat(121)}`,
  );
  check(
    "Bad dates and oversized region names are rejected",
    badDate.status === 400 &&
      badDate.body.success === false &&
      longRegion.status === 400 &&
      longRegion.body.success === false,
    JSON.stringify({ badDate: badDate.status, longRegion: longRegion.status }),
  );

  const missing = await request("/api/public/assess");
  const half = await request("/api/public/assess?lat=6.69");
  const invalid = await request("/api/public/assess?lat=999&lng=0");
  check(
    "Missing or invalid coordinates are rejected",
    missing.status === 400 && half.status === 400 && invalid.status === 400 &&
      missing.body.success === false &&
      invalid.body.success === false,
    JSON.stringify({ missing: missing.status, half: half.status, invalid: invalid.status }),
  );

  const unknown = await request("/api/public/assess?region=Atlantis");
  check(
    "Unknown region does not silently fall back to Accra",
    unknown.status === 404 && unknown.body.success === false,
    JSON.stringify(unknown.body),
  );

  const iowa = await request(`/api/public/assess?lat=${IOWA.lat}&lng=${IOWA.lng}`);
  check(
    "A point outside Ghana is unsupported and still uses NASA POWER rainfall",
    iowa.status === 200 &&
      iowa.body.supported === false &&
      iowa.body.aiRecommendation?.zone === null &&
      iowa.body.aiRecommendation?.crop === "Unsupported location" &&
      iowa.body.moisture?.annualRainfallMm === 914 &&
      iowa.body.moisture?.level === "moderate" &&
      iowa.body.provenance?.source === "NASA POWER" &&
      !/Upper West/i.test(JSON.stringify(iowa.body.aiRecommendation)),
    JSON.stringify({
      status: iowa.status,
      zone: iowa.body.aiRecommendation?.zone,
      moisture: iowa.body.moisture,
    }),
  );

  const locked = await request("/api/climate-recommendations");
  const personalLocked = await request("/api/personal-recommendations");
  const farmLocked = await request("/api/farm", { method: "PUT" });
  check(
    "Existing authenticated routes still reject anonymous callers",
    locked.status === 401 && personalLocked.status === 401 && farmLocked.status === 401,
    JSON.stringify({
      climate: locked.status,
      personal: personalLocked.status,
      farm: farmLocked.status,
    }),
  );

  const root = await request("/");
  check(
    "Root status names the k-NN classifier and the public demo",
    root.status === 200 &&
      root.body.engine === "k-NN (k=3) over 12 NASA POWER reference hubs" &&
      root.body.classifier?.referenceHubs === 12 &&
      root.body.classifier?.k === 3 &&
      String(root.body.publicDemo?.latLng).includes("/api/public/assess") &&
      String(root.body.publicDemo?.region).includes("region=") &&
      !/ml-cart|decision tree|16-hub/i.test(JSON.stringify(root.body)),
    JSON.stringify(root.body),
  );

  process.env.PUBLIC_ASSESS_RATE_LIMIT = "2";
  resetPublicRateLimit();
  const headers = { "x-forwarded-for": "198.51.100.20" };
  const first = await request(`/api/public/assess?lat=${KUMASI.lat}&lng=${KUMASI.lng}`, { headers });
  const second = await request(`/api/public/assess?lat=${KUMASI.lat}&lng=${KUMASI.lng}`, { headers });
  const third = await request(`/api/public/assess?lat=${KUMASI.lat}&lng=${KUMASI.lng}`, { headers });
  check(
    "Public demo rate limit returns 429",
    first.status === 200 &&
      second.status === 200 &&
      third.status === 429 &&
      third.body.success === false &&
      Number(third.retryAfter) >= 1,
    JSON.stringify({
      first: first.status,
      second: second.status,
      third: third.status,
      retryAfter: third.retryAfter,
      body: third.body,
    }),
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}

if (failures.length) {
  console.error(`\n${failures.length} public check(s) failed.`);
  process.exit(1);
}
console.log("\nAll public demo checks passed.");
