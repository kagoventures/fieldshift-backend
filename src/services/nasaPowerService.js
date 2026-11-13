
const NASA_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
const NASA_PARAMETERS = ["T2M", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN"];
const NASA_COMMUNITY = "AG";
const OWM_URL = "https://api.openweathermap.org/data/2.5/weather";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_USER_AGENT =
  "FieldShiftAgriAdapterDashboard/1.0 (SpaceApps2026)";

const REQUEST_TIMEOUT_MS = 15_000;
const NASA_TTL_MS = 24 * 60 * 60 * 1000;
const OWM_TTL_MS = 10 * 60 * 1000;
const GEOCODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MODEL_RETRY_MS = 10 * 60 * 1000; 
const NASA_CONCURRENCY = 4;
const NASA_FILL_VALUE = -999;
const K_NEIGHBOURS = 3;


const FEATURE_WEIGHTS = [1, 1.5, 0.5, 1, 1];

const GHANA_BOUNDS = { minLat: 4.5, maxLat: 11.3, minLng: -3.4, maxLng: 1.4 };

const DEBUG = process.env.CROP_DEBUG === "1";
const log = {
  debug: (...a) => DEBUG && console.log("[crop]", ...a),
  info: (...a) => console.log("[crop]", ...a),
  warn: (...a) => console.warn("[crop]", ...a),
  error: (...a) => console.error("[crop]", ...a),
};


const CROP_MAP = {
  0: {
    name: "Ashanti & Forest Zone (Cocoa, Plantain, Cocoyam, Maize, Citrus)",
    reasoning:
      "High annual precipitation (>1,300mm) and dense canopy moisture profiles typical of the middle forest belt.",
    cropPool: [
      "Cocoa",
      "Plantain",
      "Cocoyam (Taro)",
      "Yellow Yam",
      "Maize",
      "Citrus",
      "Avocado",
      "Garden Eggs",
      "Hot Pepper",
    ],
    optimalConditions: "Rainfall: 1,300–1,700mm | Temp: 24–28°C",
    soilNutrients: "High organic carbon, nitrogen-responsive forest ochrosols",
  },
  1: {
    name: "Western & Western-North Rainforest Belt (Oil Palm, Rubber, Plantain, Swamp Rice)",
    reasoning:
      "Exceptional atmospheric humidity and heavy year-round rainfall parameters favor perennial tree crops and hydromorphic staples.",
    cropPool: [
      "Oil Palm",
      "Rubber",
      "Plantain",
      "Swamp Rice",
      "Cassava",
      "Water Yam",
      "Coconut",
      "Black Pepper",
    ],
    optimalConditions: "Rainfall: 1,500–2,200mm | Temp: 25–29°C",
    soilNutrients: "Deep acidic ferralsols, requires organic mulching",
  },
  2: {
    name: "Bono / Ahafo Transition Belt (Puna Yam, Cashew, Maize, Soybean)",
    reasoning:
      "Transitional boundary telemetry between forest and savannah supports deep-rooting tubers and legume rotations.",
    cropPool: [
      "Puna Yam",
      "White Yam",
      "Cashew",
      "Maize",
      "Soybean",
      "Cowpea",
      "Pigeon Pea",
      "Mangoes",
      "Tomatoes",
    ],
    optimalConditions: "Rainfall: 1,100–1,400mm | Temp: 26–31°C",
    soilNutrients: "Transitional sandy-clay loam",
  },
  3: {
    name: "Northern Region Guinea Savannah (Sorghum, Cowpea, Groundnut, Yam)",
    reasoning:
      "Single-max rainy season thermal profile ideal for cereal-legume intercropping and mounded yam cultivation.",
    cropPool: [
      "Sorghum",
      "Late Millet",
      "Maize",
      "Cowpea",
      "Groundnuts",
      "Bambara Groundnuts",
      "White Yam",
      "Soybean",
    ],
    optimalConditions: "Rainfall: 800–1,100mm | Temp: 28–36°C",
    soilNutrients: "Ferruginous savannah soils",
  },
  4: {
    name: "Upper East Sudan Savannah & Irrigation (Paddy Rice, Millet, Onion, Tomato)",
    reasoning:
      "High solar radiation and elevated thermal indexes favor irrigated valley rice and dry-season market vegetables.",
    cropPool: [
      "Lowland Irrigated Rice",
      "Early Millet",
      "Dry Season Bulb Onions",
      "Tomatoes",
      "Hot Pepper",
      "Watermelon",
      "Sorghum",
    ],
    optimalConditions: "Rainfall/Irrigation: 600–900mm | Temp: 29–39°C",
    soilNutrients: "Hydromorphic valley soils and alluvial silt",
  },
  5: {
    name: "Upper West Arid Strip (Early Millet, Bambara Groundnut, Shea, Cowpea)",
    reasoning:
      "Severe moisture deficit metrics require drought-hardy cultivars and deep-rooted agroforestry systems.",
    cropPool: [
      "Early Millet",
      "Sorghum",
      "Bambara Groundnuts",
      "Groundnuts",
      "Cowpea",
      "Shea",
      "Baobab",
      "Sesame",
    ],
    optimalConditions: "Rainfall: 400–700mm | Temp: 30–40°C",
    soilNutrients: "Light lithosols and sandy loams",
  },
  6: {
    name: "Peri-Urban Savannah (Maize, Okra, Pepper, Cassava)",
    reasoning:
      "Coastal savannah microclimate with moderate rainfall and warm breezes favors fast-maturing vegetables and drought-resilient staples.",
    cropPool: [
      "Short-Season Maize",
      "Okra",
      "Hot Pepper",
      "Garden Eggs",
      "Cassava",
      "Shallots",
      "Spring Onions",
      "Watermelon",
      "Cowpea",
    ],
    optimalConditions: "Rainfall: 650–950mm | Temp: 27–33°C",
    soilNutrients: "Coastal sandy-clay and savanna ochrosols",
  },
  7: {
    name: "Volta Region Coastal & Lower Basin Belt (Shallots, Coconut, Paddy Rice)",
    reasoning:
      "Coastal wind speed, high water table, and alluvial estuary conditions support intensive shallot beds and rice paddies.",
    cropPool: [
      "Shallots",
      "Paddy Rice",
      "Coconut Palms",
      "Cassava",
      "Maize",
      "Sugarcane",
      "Okra",
      "Sweet Potato",
    ],
    optimalConditions: "Rainfall: 800–1,100mm | Temp: 26–32°C",
    soilNutrients: "Sandy marine and alluvial basin soils",
  },
  8: {
    name: "Volta Lake Basin & Afram Plains Corridor (Yam, Maize, Cassava, Cowpea)",
    reasoning:
      "High valley moisture retention and inland basin humidity support robust tuber bulking and grain production.",
    cropPool: [
      "White Yam",
      "Yellow Maize",
      "Cassava",
      "Cocoyam",
      "Cowpea",
      "Sorghum",
      "Sweet Potato",
      "Groundnuts",
    ],
    optimalConditions: "Rainfall: 1,000–1,300mm | Temp: 27–33°C",
    soilNutrients: "Alluvial vertisols and gleysols",
  },
  9: {
    name: "Central Region Horticulture Belt (Pineapple, Citrus, Cassava, Papaya)",
    reasoning:
      "Balanced coastal proximity and sub-humid forest-fringe rainfall create ideal conditions for commercial fruit horticulture.",
    cropPool: [
      "MD2 Pineapples",
      "Sweet Orange (Citrus)",
      "Papaya",
      "Cassava",
      "Maize",
      "Plantain",
      "Passion Fruit",
      "Coconut",
    ],
    optimalConditions: "Rainfall: 1,000–1,400mm | Temp: 25–30°C",
    soilNutrients: "Well-drained coastal forest ochrosols",
  },
  10: {
    name: "Eastern Region Semi-Deciduous & Ridge Belt (Cocoa, Oil Palm, Pineapple, Plantain)",
    reasoning:
      "Akuapem-Togo ridge elevation and semi-deciduous forest moisture support diverse cash crops, upland horticulture, and tubers.",
    cropPool: [
      "Cocoa",
      "Oil Palm",
      "Smooth Cayenne Pineapple",
      "Plantain",
      "Cassava",
      "Cocoyam",
      "Maize",
      "Ginger",
      "Kola",
    ],
    optimalConditions: "Rainfall: 1,200–1,600mm | Temp: 24–29°C",
    soilNutrients: "Fertile forest ochrosol-oxisol intergrades",
  },
};


const REFERENCE_HUBS = [
  {
    name: "Kumasi (Ashanti Forest)",
    zone: 0,
    lat: 6.6963,
    lng: -1.6152,
    baseline: { avgTemp: 26.5, totalRain: 1500, avgSolar: 4.8 },
  },
  {
    name: "Takoradi (Western Rainforest)",
    zone: 1,
    lat: 4.8964,
    lng: -1.7554,
    baseline: { avgTemp: 27.0, totalRain: 1800, avgSolar: 4.3 },
  },
  {
    name: "Sunyani (Bono Transition)",
    zone: 2,
    lat: 7.3399,
    lng: -2.3267,
    baseline: { avgTemp: 28.5, totalRain: 1250, avgSolar: 5.1 },
  },
  {
    name: "Tamale (Guinea Savannah)",
    zone: 3,
    lat: 9.4072,
    lng: -0.8532,
    baseline: { avgTemp: 30.2, totalRain: 950, avgSolar: 5.8 },
  },
  {
    name: "Navrongo (Upper East Sudan)",
    zone: 4,
    lat: 10.8956,
    lng: -1.0921,
    baseline: { avgTemp: 32.1, totalRain: 750, avgSolar: 6.2 },
  },
  {
    name: "Wa (Upper West Arid)",
    zone: 5,
    lat: 10.0601,
    lng: -2.5019,
    baseline: { avgTemp: 33.5, totalRain: 500, avgSolar: 6.6 },
  },
  {
    name: "Accra (Greater Accra Coastal)",
    zone: 6,
    lat: 5.6037,
    lng: -0.187,
    baseline: { avgTemp: 28.5, totalRain: 780, avgSolar: 5.4 },
  },
  {
    name: "Pokuase (Greater Accra Inland)",
    zone: 6,
    lat: 5.6911,
    lng: -0.2814,
    baseline: { avgTemp: 28.3, totalRain: 820, avgSolar: 5.3 },
  },
  {
    name: "Keta (Volta Coastal Basin)",
    zone: 7,
    lat: 5.9182,
    lng: 0.9908,
    baseline: { avgTemp: 28.0, totalRain: 950, avgSolar: 5.2 },
  },
  {
    name: "Kpandai (Volta Lake Basin)",
    zone: 8,
    lat: 8.475,
    lng: -0.0097,
    baseline: { avgTemp: 29.0, totalRain: 1150, avgSolar: 5.5 },
  },
  {
    name: "Cape Coast (Central Horticulture)",
    zone: 9,
    lat: 5.1053,
    lng: -1.2466,
    baseline: { avgTemp: 27.5, totalRain: 1200, avgSolar: 4.9 },
  },
  {
    name: "Koforidua (Eastern Region)",
    zone: 10,
    lat: 6.0941,
    lng: -0.2591,
    baseline: { avgTemp: 26.8, totalRain: 1350, avgSolar: 5.0 },
  },
];


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

class TtlCache {
  constructor(ttlMs, maxEntries = 500) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.map = new Map();
  }
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }
  set(key, value) {
    if (this.map.size >= this.maxEntries) {
      this.map.delete(this.map.keys().next().value); // evict oldest
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

const nasaCache = new TtlCache(NASA_TTL_MS);
const owmCache = new TtlCache(OWM_TTL_MS);
const geocodeCache = new TtlCache(GEOCODE_TTL_MS, 1000);

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}


async function fetchJson(
  url,
  { headers, retries = 1, label = "request" } = {},
) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(
          `${label} HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
        err.status = res.status;
        throw err;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      const retryable = !err.status || err.status === 429 || err.status >= 500;
      if (!retryable || attempt === retries) break;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError;
}

function validateCoords(lat, lng) {
  const la = typeof lat === "number" ? lat : parseFloat(lat);
  const ln = typeof lng === "number" ? lng : parseFloat(lng);
  if (
    !Number.isFinite(la) ||
    !Number.isFinite(ln) ||
    Math.abs(la) > 90 ||
    Math.abs(ln) > 180
  ) {
    throw new RangeError(`Invalid coordinates: lat=${lat}, lng=${lng}`);
  }
  return { lat: la, lng: ln };
}

const isInGhana = (lat, lng) =>
  lat >= GHANA_BOUNDS.minLat &&
  lat <= GHANA_BOUNDS.maxLat &&
  lng >= GHANA_BOUNDS.minLng &&
  lng <= GHANA_BOUNDS.maxLng;

// Last full calendar year, so training and prediction use the same closed window.
function defaultWindow() {
  const year = new Date().getUTCFullYear() - 1;
  return { start: `${year}0101`, end: `${year}1231` };
}

function normalizePowerDate(value, fallback) {
  if (value == null || value === "") return fallback;
  const digits = String(value).trim().replace(/-/g, "");
  if (!/^\d{8}$/.test(digits)) {
    throw new RangeError(`Invalid NASA POWER date: ${value}`);
  }
  return digits;
}

function resolveWindow(start, end) {
  const win = defaultWindow();
  const resolved = {
    start: normalizePowerDate(start, win.start),
    end: normalizePowerDate(end, win.end),
  };
  if (resolved.start > resolved.end) {
    throw new RangeError(
      `NASA POWER start ${resolved.start} is after end ${resolved.end}`,
    );
  }
  return resolved;
}

export async function fetchNasaPowerData(lat, lng, start, end) {
  const win = resolveWindow(start, end);
  const params = new URLSearchParams({
    parameters: NASA_PARAMETERS.join(","),
    community: NASA_COMMUNITY,
    longitude: lng,
    latitude: lat,
    start: win.start,
    end: win.end,
    format: "JSON",
  });
  const data = await fetchJson(`${NASA_URL}?${params}`, {
    label: "NASA POWER",
  });
  log.debug(`NASA POWER fetched for [${lat}, ${lng}]`);
  return data;
}

// Returns { avgTemp, totalRain, avgSolar } or null if any series has no valid data.
// totalRain is annualised from the daily mean, so missing days don't understate it.
export function processNasaTelemetry(nasaJson) {
  const p = nasaJson?.properties?.parameter ?? {};
  const valid = (series) =>
    Object.values(series ?? {}).filter(
      (v) => Number.isFinite(v) && v !== NASA_FILL_VALUE,
    );

  const temps = valid(p.T2M);
  const rains = valid(p.PRECTOTCORR);
  const solars = valid(p.ALLSKY_SFC_SW_DWN);
  if (!temps.length || !rains.length || !solars.length) return null;

  return {
    avgTemp: mean(temps),
    totalRain: mean(rains) * 365,
    avgSolar: mean(solars),
  };
}

async function getNasaTelemetry(lat, lng, start, end) {
  const win = resolveWindow(start, end);
  const key = `${lat.toFixed(2)}|${lng.toFixed(2)}|${win.start}|${win.end}`;
  const hit = nasaCache.get(key);
  if (hit) return hit;

  const telemetry = processNasaTelemetry(
    await fetchNasaPowerData(lat, lng, win.start, win.end),
  );
  if (!telemetry) {
    const err = new Error("NASA POWER returned no usable data");
    err.status = 422;
    throw err;
  }
  nasaCache.set(key, telemetry);
  return telemetry;
}


let warnedMissingOwmKey = false;

export async function fetchOpenWeatherMapData(lat, lng) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    if (!warnedMissingOwmKey) {
      log.warn("OPENWEATHER_API_KEY is not set; live weather disabled.");
      warnedMissingOwmKey = true;
    }
    return null;
  }

  const key = `${Number(lat).toFixed(2)}|${Number(lng).toFixed(2)}`;
  const hit = owmCache.get(key);
  if (hit) return hit;

  try {
    const params = new URLSearchParams({
      lat,
      lon: lng,
      units: "metric",
      appid: apiKey,
    });
    const data = await fetchJson(`${OWM_URL}?${params}`, {
      label: "OpenWeatherMap",
    });
    owmCache.set(key, data);
    return data;
  } catch (error) {
    log.error("OpenWeatherMap fetch failed:", error.message);
    return null;
  }
}

function toLiveWeather(owm) {
  if (!owm?.main) return null;
  return {
    stationName: owm.name,
    temp: owm.main.temp,
    feelsLike: owm.main.feels_like,
    humidity: owm.main.humidity,
    pressure: owm.main.pressure,
    clouds: owm.clouds?.all ?? 0,
    windSpeed: owm.wind?.speed ?? 0,
    weatherMain: owm.weather?.[0]?.main ?? "Clear",
    weatherDescription: owm.weather?.[0]?.description ?? "sky is clear",
  };
}


let model = null; 
let initPromise = null;

const scaleVector = (v, stats) =>
  v.map((x, i) => ((x - stats[i].mean) / stats[i].std) * FEATURE_WEIGHTS[i]);

function buildModel(hubs, complete) {
  const raw = hubs.map((h) => [
    h.climate.avgTemp,
    h.climate.totalRain,
    h.climate.avgSolar,
    h.lat,
    h.lng,
  ]);
  const stats = raw[0].map((_, i) => {
    const col = raw.map((r) => r[i]);
    const m = mean(col);
    const variance = mean(col.map((x) => (x - m) ** 2));
    return { mean: m, std: Math.sqrt(variance) || 1 };
  });
  return {
    hubs: hubs.map((h, i) => ({ ...h, vec: scaleVector(raw[i], stats) })),
    stats,
    complete,
    builtAt: Date.now(),
  };
}

export function initModelFromNasa({ force = false } = {}) {
  if (initPromise && !force) return initPromise;

  initPromise = (async () => {
    log.info(
      `Building model from ${REFERENCE_HUBS.length} reference stations...`,
    );
    let live = 0;
    const hubs = await mapWithConcurrency(
      REFERENCE_HUBS,
      NASA_CONCURRENCY,
      async (hub) => {
        try {
          const climate = await getNasaTelemetry(hub.lat, hub.lng);
          live++;
          return { ...hub, climate };
        } catch (err) {
          log.warn(
            `NASA unavailable for ${hub.name}; using baseline (${err.message})`,
          );
          return { ...hub, climate: hub.baseline };
        }
      },
    );
    model = buildModel(hubs, live === hubs.length);
    log.info(
      `Model ready (${live}/${hubs.length} stations on live NASA data).`,
    );
    return model;
  })();

 
  initPromise.catch(() => {
    initPromise = null;
  });
  return initPromise;
}

export function initAiModel() {
  return initModelFromNasa();
}

// Deterministic model from the published station baselines. Used by the zone
// check so both endpoints can be compared without calling NASA.
export function initModelFromBaselines() {
  const hubs = REFERENCE_HUBS.map((hub) => ({
    ...hub,
    climate: { ...hub.baseline },
  }));
  model = buildModel(hubs, true);
  return model;
}

async function ensureModel() {
  if (!model) {
    await initModelFromNasa();
  } else if (!model.complete && Date.now() - model.builtAt > MODEL_RETRY_MS) {
    model.builtAt = Date.now(); 
    initModelFromNasa({ force: true }).catch(() => {});
  }
  return model;
}

function classify(m, avgTemp, totalRain, avgSolar, lat, lng) {
  const q = scaleVector([avgTemp, totalRain, avgSolar, lat, lng], m.stats);
  const ranked = m.hubs
    .map((hub) => ({
      hub,
      dist: Math.hypot(...hub.vec.map((x, i) => x - q[i])),
    }))
    .sort((a, b) => a.dist - b.dist);

  const votes = new Map();
  for (const { hub, dist } of ranked.slice(0, K_NEIGHBOURS)) {
    votes.set(hub.zone, (votes.get(hub.zone) ?? 0) + 1 / (dist + 1e-6));
  }
  const total = [...votes.values()].reduce((a, b) => a + b, 0);
  const scored = [...votes]
    .map(([zone, w]) => ({ zone, confidence: w / total }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    zone: scored[0].zone,
    confidence: scored[0].confidence,
    alternatives: scored.slice(1),
    nearestHub: ranked[0].hub,
  };
}

// Used when NASA is down: inverse-distance blend of the nearest stations'
// climate, so the fallback varies by place instead of one fixed profile.
function estimateClimateFromHubs(m, lat, lng) {
  const near = m.hubs
    .map((h) => ({ h, d: Math.hypot(h.lat - lat, h.lng - lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  const weights = near.map(({ d }) => 1 / (d + 0.05));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const blend = (key) =>
    near.reduce((acc, { h }, i) => acc + h.climate[key] * weights[i], 0) / wSum;
  return {
    avgTemp: blend("avgTemp"),
    totalRain: blend("totalRain"),
    avgSolar: blend("avgSolar"),
  };
}

// Keeps the zone's two lead crops fixed, then rotates the rest by a ~11 km
// location cell. Stable for a given place (no flicker when live weather changes).
function pickCrops(pool, lat, lng, count = 5) {
  const lead = pool.slice(0, 2);
  const rest = pool.slice(2);
  if (!rest.length) return lead;
  const cell = Math.round(lat * 10) * 1000 + Math.round(lng * 10);
  const offset = Math.abs(cell) % rest.length;
  return [...lead, ...rest.slice(offset), ...rest.slice(0, offset)].slice(
    0,
    count,
  );
}

const shortZoneName = (zone) => zone.name.split("(")[0].trim();

const OUT_OF_REGION_MESSAGE =
  "These coordinates are outside Ghana. FieldShift agroecological zones and crop recommendations cover Ghana only, so no zone was assigned.";

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Words follow the rainfall total. They are not copied from a zone blurb,
// so a wet site can never be described as a severe moisture deficit.
export function assessMoisture(totalRainMm) {
  const rain = Math.round(Number(totalRainMm));
  if (!Number.isFinite(rain)) {
    return {
      level: "unknown",
      annualRainfallMm: null,
      summary: "Annual rainfall is unavailable.",
    };
  }

  let level;
  let summary;
  if (rain < 600) {
    level = "severe deficit";
    summary = `Annual rainfall is ${rain} mm, a severe moisture deficit.`;
  } else if (rain < 900) {
    level = "low";
    summary = `Annual rainfall is ${rain} mm, low moisture suited to a short single rainy season.`;
  } else if (rain < 1200) {
    level = "moderate";
    summary = `Annual rainfall is ${rain} mm, moderate moisture for a single rainy season.`;
  } else if (rain < 1600) {
    level = "high";
    summary = `Annual rainfall is ${rain} mm, high moisture.`;
  } else {
    level = "very high";
    summary = `Annual rainfall is ${rain} mm, very high moisture.`;
  }
  return { level, annualRainfallMm: rain, summary };
}

function composeReasoning(zone, moisture) {
  const staticText = zone.reasoning.trim();
  const contradicts =
    /severe moisture deficit/i.test(staticText) &&
    moisture.level !== "severe deficit";
  return contradicts ? moisture.summary : `${staticText} ${moisture.summary}`;
}

function buildCropDetails(crops, zoneName, moisture, confidence) {
  return crops.map((name, index) => ({
    name,
    confidence: Number((confidence * (1 - index * 0.08)).toFixed(2)),
    reason:
      index < 2
        ? `${name} is a lead crop for ${zoneName}. ${moisture.summary}`
        : `${name} is a companion crop for ${zoneName}. ${moisture.summary}`,
  }));
}

function climateSummaryFrom(climate) {
  return {
    averageTemperatureC: roundTo(climate.avgTemp, 1),
    totalPrecipitationMm: roundTo(climate.totalRain, 0),
    averageSolarRadiation: roundTo(climate.avgSolar, 2),
  };
}

function formatTelemetry(climate) {
  return {
    avgTemp: climate.avgTemp.toFixed(1),
    totalRain: climate.totalRain.toFixed(0),
    avgSolar: climate.avgSolar.toFixed(1),
  };
}

function buildProvenance(win, estimated) {
  return {
    source: estimated ? "Regional baseline estimate" : "NASA POWER",
    parameters: [...NASA_PARAMETERS],
    dateRange: { start: win.start, end: win.end },
    community: NASA_COMMUNITY,
  };
}

function unsupportedRecommendation(message, moisture, liveWeather) {
  return {
    name: "Unsupported location",
    zoneName: null,
    zoneId: null,
    supported: false,
    reasoning: `${message} ${moisture.summary}`,
    recommendedCrops: [],
    primaryStaples: [],
    cashAndCompanionCrops: [],
    cropDetails: [],
    cropPool: [],
    optimalConditions: null,
    soilNutrients: null,
    confidence: null,
    nearestReferenceStation: null,
    alternativeZones: [],
    liveConditionNote: liveWeather
      ? `Live conditions in ${liveWeather.stationName || "area"}: ${liveWeather.temp}°C, ${liveWeather.humidity}% humidity. No crop zone was assigned because this point is outside Ghana.`
      : message,
  };
}

function recommendInRegion(climate, coords, liveWeather, moisture) {
  if (!model) {
    throw new Error("Model not initialised. Await initAiModel() first.");
  }
  const result = classify(
    model,
    climate.avgTemp,
    climate.totalRain,
    climate.avgSolar,
    coords.lat,
    coords.lng,
  );
  const zone = CROP_MAP[result.zone];
  const zoneName = shortZoneName(zone);
  const crops = pickCrops(zone.cropPool, coords.lat, coords.lng);
  const confidence = Number(result.confidence.toFixed(2));

  return {
    ...zone,
    name: `${zoneName} (${crops.slice(0, 4).join(", ")})`,
    zoneName,
    zoneId: result.zone,
    supported: true,
    reasoning: composeReasoning(zone, moisture),
    recommendedCrops: crops,
    primaryStaples: crops.slice(0, 2),
    cashAndCompanionCrops: crops.slice(2),
    cropDetails: buildCropDetails(crops, zoneName, moisture, confidence),
    confidence,
    nearestReferenceStation: result.nearestHub.name,
    alternativeZones: result.alternatives.map((alt) => ({
      zoneId: alt.zone,
      name: shortZoneName(CROP_MAP[alt.zone]),
      confidence: Number(alt.confidence.toFixed(2)),
    })),
    liveConditionNote: liveWeather
      ? `Live conditions in ${liveWeather.stationName || "area"}: ${liveWeather.temp}°C, ${liveWeather.humidity}% humidity (shown for context; the zone is based on the annual climate profile).`
      : "Based on annual NASA POWER satellite climate profile.",
  };
}


// 4. Public prediction + recommendation API
// Single path for both endpoints. Coordinates are required: omitting them used
// to fall back to Accra and assign a coastal zone to inland farms.

export function getMlRecommendation(
  avgTemp,
  totalRain,
  avgSolar,
  lat,
  lng,
  liveWeather = null,
) {
  const coords = validateCoords(lat, lng);
  const climate = { avgTemp, totalRain, avgSolar };
  const moisture = assessMoisture(totalRain);
  if (!isInGhana(coords.lat, coords.lng)) {
    return unsupportedRecommendation(
      OUT_OF_REGION_MESSAGE,
      moisture,
      liveWeather,
    );
  }
  return recommendInRegion(climate, coords, liveWeather, moisture);
}

/**
 * Shared climate, zone, and crop decision for a coordinate pair.
 * Both /api/personal-recommendations and /api/climate-recommendations use this.
 * Pass `climate` to skip the NASA fetch (tests and the map path, which fetches
 * NASA and OpenWeather together).
 */
export async function assessCoordinates(lat, lng, options = {}) {
  const coords = validateCoords(lat, lng);
  const win = resolveWindow(options.start, options.end);
  const supported = isInGhana(coords.lat, coords.lng);
  const estimated = Boolean(options.estimated);

  const climate =
    options.climate ??
    (await getNasaTelemetry(coords.lat, coords.lng, win.start, win.end));
  const moisture = assessMoisture(climate.totalRain);
  const warnings = [...(options.extraWarnings ?? [])];
  const liveWeather = options.liveWeather ?? null;
  const provenance = buildProvenance(win, estimated);

  let recommendation;
  let message = null;
  if (!supported) {
    message = OUT_OF_REGION_MESSAGE;
    warnings.unshift(message);
    recommendation = unsupportedRecommendation(message, moisture, liveWeather);
  } else {
    await ensureModel();
    recommendation = recommendInRegion(climate, coords, liveWeather, moisture);
  }

  const dataSource =
    options.dataSource ??
    (estimated
      ? "Offline Regional Baseline Estimate"
      : "NASA POWER Satellite Telemetry");

  log.debug(
    `[${coords.lat}, ${coords.lng}] supported=${supported} -> ${recommendation.name}`,
  );

  return {
    supported,
    message,
    warnings,
    dataSource,
    provenance,
    moisture,
    coordinates: coords,
    climate,
    climateSummary: climateSummaryFrom(climate),
    telemetry: formatTelemetry(climate),
    liveWeather,
    recommendation,
  };
}

export async function getSmartCropRecommendation(lat, lng) {
  const coords = validateCoords(lat, lng);
  const inGhana = isInGhana(coords.lat, coords.lng);

  // Fetch both sources independently so one failing doesn't discard the other.
  const [nasaResult, owmResult] = await Promise.allSettled([
    getNasaTelemetry(coords.lat, coords.lng),
    fetchOpenWeatherMapData(coords.lat, coords.lng),
  ]);
  const liveWeather =
    owmResult.status === "fulfilled" ? toLiveWeather(owmResult.value) : null;

  let climate;
  let dataSource;
  let estimated = false;
  const extraWarnings = [];

  if (nasaResult.status === "fulfilled") {
    climate = nasaResult.value;
    dataSource = liveWeather
      ? "NASA POWER Satellite Telemetry + OpenWeatherMap Real-Time API"
      : "NASA POWER Satellite Telemetry";
  } else if (inGhana) {
    log.warn(
      "NASA POWER failed, estimating from nearby stations:",
      nasaResult.reason?.message,
    );
    const m = await ensureModel();
    climate = estimateClimateFromHubs(m, coords.lat, coords.lng);
    estimated = true;
    dataSource = liveWeather
      ? "Regional Baseline Estimate + OpenWeatherMap Real-Time API"
      : "Offline Regional Baseline Estimate";
    extraWarnings.push(
      "NASA POWER unavailable; climate estimated from nearby reference stations.",
    );
  } else {
    throw nasaResult.reason;
  }

  return assessCoordinates(coords.lat, coords.lng, {
    climate,
    liveWeather,
    dataSource,
    extraWarnings,
    estimated,
  });
}


let nextGeocodeSlot = 0;

async function waitForGeocodeSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextGeocodeSlot);
  nextGeocodeSlot = slot + 1100; 
  if (slot > now) await sleep(slot - now);
}

export async function lookupCoordinates(regionName) {
  const query = typeof regionName === "string" ? regionName.trim() : "";
  if (!query) return null;

  const cacheKey = query.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    await waitForGeocodeSlot();
    const params = new URLSearchParams({
      q: query,
      countrycodes: "gh",
      format: "json",
      limit: "1",
    });
    const data = await fetchJson(`${NOMINATIM_URL}?${params}`, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
      label: "Nominatim",
    });

    const top = data?.[0];
    const result = top
      ? {
          lat: parseFloat(top.lat),
          lng: parseFloat(top.lon),
          formattedName: top.display_name,
        }
      : null;
    geocodeCache.set(cacheKey, result);
    log.debug(`Geocoded "${query}" ->`, result);
    return result;
  } catch (error) {
    log.error("Geocoding lookup error:", error.message);
    return null;
  }
}
