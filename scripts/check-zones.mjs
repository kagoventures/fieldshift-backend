import {
  assessCoordinates,
  assessMoisture,
  getMlRecommendation,
  initModelFromBaselines,
} from "../src/services/nasaPowerService.js";
import {
  toFarmResponse,
  toPersonalResponse,
} from "../src/controllers/climateController.js";

const KUMASI = { lat: 6.6885, lng: -1.6244, name: "Kumasi, Ghana" };
const IOWA = { lat: 41.5868, lng: -93.625, name: "Des Moines, Iowa" };
const KUMASI_CLIMATE = { avgTemp: 26.5, totalRain: 1500, avgSolar: 4.8 };
const IOWA_CLIMATE = { avgTemp: 10.2, totalRain: 914, avgSolar: 3.6 };

const failures = [];

function check(name, condition, detail) {
  if (condition) {
    console.log(`ok  ${name}`);
    return;
  }
  failures.push(name);
  console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
}

function farmMeta(place) {
  return {
    searchedQuery: place.name,
    locationName: place.name,
    lat: place.lat,
    lng: place.lng,
    currentCrop: "Maize",
    fieldSize: 2.5,
  };
}

initModelFromBaselines();

// Dashboard route calls assessCoordinates. Map route calls
// getSmartCropRecommendation, which classifies through assessCoordinates
// with the same coordinates and the same annualised rainfall.
const dashboardAssessment = await assessCoordinates(KUMASI.lat, KUMASI.lng, {
  climate: KUMASI_CLIMATE,
});
const mapAssessment = await assessCoordinates(KUMASI.lat, KUMASI.lng, {
  climate: KUMASI_CLIMATE,
  dataSource: "NASA POWER Satellite Telemetry",
});

const personal = toPersonalResponse(dashboardAssessment, farmMeta(KUMASI));
const farm = toFarmResponse(mapAssessment, farmMeta(KUMASI));

check(
  "Kumasi dashboard and map return the same zone string",
  personal.aiRecommendation.crop === farm.aiRecommendation.suggestedAdaptiveCrop,
  `${personal.aiRecommendation.crop} vs ${farm.aiRecommendation.suggestedAdaptiveCrop}`,
);
check(
  "Kumasi zone is Ashanti & Forest Zone",
  personal.aiRecommendation.zone === "Ashanti & Forest Zone" &&
    farm.aiRecommendation.zone === "Ashanti & Forest Zone",
  personal.aiRecommendation.zone,
);
check("Kumasi is supported", personal.supported === true && farm.supported === true);
check(
  "Kumasi moisture matches 1500 mm",
  personal.moisture.annualRainfallMm === 1500 &&
    personal.moisture.level === "high" &&
    personal.climateSummary.totalPrecipitationMm ===
      farm.climateSummary.totalPrecipitationMm,
  JSON.stringify(personal.moisture),
);

const direct = getMlRecommendation(
  KUMASI_CLIMATE.avgTemp,
  KUMASI_CLIMATE.totalRain,
  KUMASI_CLIMATE.avgSolar,
  KUMASI.lat,
  KUMASI.lng,
);
check(
  "Classifier with explicit Kumasi coordinates matches the shared assessment",
  direct.zoneName === dashboardAssessment.recommendation.zoneName,
  direct.zoneName,
);

let missingCoordsThrew = false;
try {
  getMlRecommendation(
    KUMASI_CLIMATE.avgTemp,
    KUMASI_CLIMATE.totalRain,
    KUMASI_CLIMATE.avgSolar,
  );
} catch (err) {
  missingCoordsThrew = err instanceof RangeError;
}
check(
  "Omitting coordinates no longer silently uses Accra",
  missingCoordsThrew,
);

const iowaAssessment = await assessCoordinates(IOWA.lat, IOWA.lng, {
  climate: IOWA_CLIMATE,
});
const iowaPersonal = toPersonalResponse(iowaAssessment, farmMeta(IOWA));
const iowaFarm = toFarmResponse(iowaAssessment, farmMeta(IOWA));
const iowaBlob = JSON.stringify({ iowaPersonal, iowaFarm });

check(
  "Iowa is flagged unsupported on both responses",
  iowaPersonal.supported === false &&
    iowaFarm.supported === false &&
    Boolean(iowaPersonal.message),
  iowaPersonal.message,
);
check(
  "Iowa is not given a Ghana zone",
  iowaPersonal.aiRecommendation.zone === null &&
    iowaFarm.aiRecommendation.zone === null &&
    iowaPersonal.aiRecommendation.crop === "Unsupported location" &&
    iowaFarm.aiRecommendation.suggestedAdaptiveCrop === "Unsupported location" &&
    !/Upper West/i.test(iowaBlob) &&
    !/Ashanti/i.test(iowaBlob),
);
check(
  "Iowa moisture matches 914 mm and is not a severe deficit",
  iowaAssessment.moisture.annualRainfallMm === 914 &&
    iowaAssessment.moisture.level === "moderate" &&
    !/severe moisture deficit/i.test(iowaBlob) &&
    iowaPersonal.moisture.summary === iowaFarm.moisture.summary,
  iowaAssessment.moisture.summary,
);
check(
  "Responses include NASA POWER provenance and per-crop reasons",
  personal.provenance?.source === "NASA POWER" &&
    Array.isArray(personal.provenance.parameters) &&
    personal.provenance.parameters.includes("PRECTOTCORR") &&
    personal.provenance.dateRange?.start &&
    personal.provenance.dateRange?.end &&
    personal.aiRecommendation.crops.length > 0 &&
    personal.aiRecommendation.crops.every(
      (crop) => crop.name && crop.reason && typeof crop.confidence === "number",
    ),
);

const severe = assessMoisture(480);
const low = assessMoisture(809);
const moderate = assessMoisture(914);
check(
  "Moisture bands follow the rainfall total",
  severe.level === "severe deficit" &&
    low.level === "low" &&
    moderate.level === "moderate" &&
    !/severe moisture deficit/i.test(low.summary) &&
    !/severe moisture deficit/i.test(moderate.summary) &&
    /severe moisture deficit/i.test(severe.summary),
  `${severe.level} / ${low.level} / ${moderate.level}`,
);

if (process.argv.includes("--live")) {
  console.log("\nLive NASA POWER check...");
  const liveKumasi = await assessCoordinates(KUMASI.lat, KUMASI.lng);
  const liveIowa = await assessCoordinates(IOWA.lat, IOWA.lng);
  console.log(
    `Kumasi live: supported=${liveKumasi.supported} zone=${liveKumasi.recommendation.zoneName} rain=${liveKumasi.moisture.annualRainfallMm} mm`,
  );
  console.log(
    `Iowa live: supported=${liveIowa.supported} name=${liveIowa.recommendation.name} rain=${liveIowa.moisture.annualRainfallMm} mm level=${liveIowa.moisture.level}`,
  );
  console.log(`Iowa message: ${liveIowa.message}`);
  console.log(`Iowa moisture: ${liveIowa.moisture.summary}`);
  check(
    "Live Kumasi is supported Ashanti forest",
    liveKumasi.supported === true &&
      liveKumasi.recommendation.zoneName === "Ashanti & Forest Zone",
    liveKumasi.recommendation.zoneName,
  );
  check(
    "Live Iowa is unsupported and moisture quotes the NASA rainfall",
    liveIowa.supported === false &&
      liveIowa.recommendation.zoneName == null &&
      liveIowa.moisture.summary.includes(String(liveIowa.moisture.annualRainfallMm)) &&
      (liveIowa.moisture.annualRainfallMm < 600 ||
        liveIowa.moisture.level !== "severe deficit"),
    liveIowa.moisture.summary,
  );
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll zone checks passed.");
