import User from "../models/User.js";
import {
  assessCoordinates,
  CLASSIFIER_LABEL,
  classifierInfo,
  getSmartCropRecommendation,
  lookupCoordinates,
  SUPPORTED_CONFIDENCE_LABEL,
} from "../services/nasaPowerService.js";
import Farm from "../models/Farm.js";

const MODEL_LABEL = CLASSIFIER_LABEL;

function confidenceLabel(assessment) {
  return assessment.supported
    ? SUPPORTED_CONFIDENCE_LABEL
    : "Unavailable outside supported region";
}

function sharedAiFields(assessment) {
  const rec = assessment.recommendation;
  return {
    confidenceScore: confidenceLabel(assessment),
    reasoning: rec.reasoning,
    confidence: rec.confidence ?? null,
    zone: assessment.supported ? rec.zoneName : null,
    zoneId: assessment.supported ? rec.zoneId : null,
    crops: rec.cropDetails ?? [],
    supported: assessment.supported,
    classifier: classifierInfo(),
  };
}

function sharedEnvelope(assessment) {
  return {
    success: true,
    supported: assessment.supported,
    message: assessment.message,
    provenance: assessment.provenance,
    warnings: assessment.warnings,
    climateSummary: assessment.climateSummary,
    moisture: assessment.moisture,
  };
}

// Dashboard (/api/personal-recommendations). `crop` stays the zone string.
export function toPersonalResponse(assessment, farm) {
  const recommendation = {
    crop: assessment.recommendation.name,
    ...sharedAiFields(assessment),
    model: MODEL_LABEL,
  };
  return {
    ...sharedEnvelope(assessment),
    dataSource: assessment.dataSource,
    farm: {
      searchedQuery: farm.searchedQuery,
      resolvedLocation: farm.locationName,
      coordinates: { lat: farm.lat, lng: farm.lng },
      currentCrop: farm.currentCrop,
      fieldSize: farm.fieldSize,
    },
    // Same object. `recommendation` is the honest name; `aiRecommendation` stays for the frontend.
    recommendation,
    aiRecommendation: recommendation,
  };
}

// Map / recommendations (/api/climate-recommendations).
export function toFarmResponse(assessment, farm) {
  const recommendation = {
    suggestedAdaptiveCrop: assessment.recommendation.name,
    ...sharedAiFields(assessment),
    modelEngine: MODEL_LABEL,
  };
  return {
    ...sharedEnvelope(assessment),
    dataSource: assessment.dataSource,
    farmDetails: {
      locationName: farm.locationName,
      coordinates: { lat: farm.lat, lng: farm.lng },
      currentCrop: farm.currentCrop,
      fieldSize: `${farm.fieldSize} Hectares`,
    },
    liveWeather: assessment.liveWeather || null,
    recommendation,
    aiRecommendation: recommendation,
  };
}

function firstQueryValue(value) {
  const picked = Array.isArray(value) ? value[0] : value;
  if (picked == null) return "";
  return String(picked).trim();
}

export function toPublicResponse(assessment, location) {
  const recommendation = {
    crop: assessment.recommendation.name,
    suggestedAdaptiveCrop: assessment.recommendation.name,
    ...sharedAiFields(assessment),
    model: MODEL_LABEL,
    modelEngine: MODEL_LABEL,
  };
  return {
    ...sharedEnvelope(assessment),
    dataSource: assessment.dataSource,
    location,
    liveWeather: assessment.liveWeather || null,
    recommendation,
    aiRecommendation: recommendation,
  };
}

// No login. Same NASA POWER assessment as the authenticated farm routes.
export async function getPublicAssessment(req, res) {
  try {
    const latRaw = firstQueryValue(req.query.lat);
    const lngRaw = firstQueryValue(req.query.lng);
    const region = firstQueryValue(req.query.region);
    if (region.length > 120) {
      return res.status(400).json({
        success: false,
        error: "Region name is too long. Use a town name, or pass lat and lng.",
      });
    }
    const hasLat = latRaw !== "";
    const hasLng = lngRaw !== "";

    if (hasLat !== hasLng) {
      return res.status(400).json({
        success: false,
        error: "Provide both lat and lng, or a region name.",
      });
    }

    let lat;
    let lng;
    let locationName;
    let query = null;

    if (hasLat && hasLng) {
      lat = latRaw;
      lng = lngRaw;
      query = region || null;
      locationName = region || null;
    } else if (region) {
      const found = await lookupCoordinates(region);
      if (!found) {
        return res.status(404).json({
          success: false,
          error: `No Ghana location found for "${region}". Try a town name, or pass lat and lng.`,
        });
      }
      lat = found.lat;
      lng = found.lng;
      locationName = found.formattedName;
      query = region;
    } else {
      return res.status(400).json({
        success: false,
        error:
          "Provide lat and lng, or region. Example: /api/public/assess?lat=6.6885&lng=-1.6244 or /api/public/assess?region=Kumasi",
      });
    }

    const assessment = await getSmartCropRecommendation(lat, lng, {
      start: firstQueryValue(req.query.start) || undefined,
      end: firstQueryValue(req.query.end) || undefined,
    });

    return res.json(
      toPublicResponse(assessment, {
        query,
        name:
          locationName ||
          `${assessment.coordinates.lat}, ${assessment.coordinates.lng}`,
        coordinates: {
          lat: assessment.coordinates.lat,
          lng: assessment.coordinates.lng,
        },
      }),
    );
  } catch (err) {
    return sendAssessmentError(res, err);
  }
}

function sendAssessmentError(res, err) {
  const status = err.status || (err instanceof RangeError ? 400 : 500);
  if (status >= 500) console.log(err);
  return res.status(status).json({ success: false, error: err.message });
}

export async function getClimateAndRecommendations(req, res) {
  try {
    // 1. Identify the logged-in user from the authentication middleware token
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized. Please log in to fetch your farm's climate recommendations.",
      });
    }

    // 2. Fetch the farm details from MongoDB using the Farm schema matching this user
    const userFarm = await Farm.findOne({ userId: userId });

    if (!userFarm) {
      return res.status(404).json({
        success: false,
        error: "No registered farm found for this user account. Please map your farm layout first.",
      });
    }

    const lat = userFarm.lat;
    const lng = userFarm.lng;
    const locationName = userFarm.locationName;
    const currentCrop = userFarm.currentCrop;
    const fieldSize = userFarm.fieldSize;

    // Same assessment the dashboard uses, including the saved pin coordinates.
    const hybridResult = await getSmartCropRecommendation(lat, lng);

    return res.json(
      toFarmResponse(hybridResult, {
        locationName,
        lat,
        lng,
        currentCrop,
        fieldSize,
      }),
    );
  } catch (err) {
    return sendAssessmentError(res, err);
  }
}


export async function getPersonalizedClimateAndRecommendations(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "Unauthorized. Please log in to access your personalized farm telemetry.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "User account not found." });
    }

    // Extract user entered text string (e.g., "Kumasii")
    const rawUserRegion = user.AgriculturalRegion || user.region || "Accra";

    // 1. DYNAMIC LOOKUP: Check OpenStreetMap for the real matching coordinates online
    const locationLookup = await lookupCoordinates(rawUserRegion);

    let lat, lng, locationName;

    if (locationLookup) {
      lat = locationLookup.lat;
      lng = locationLookup.lng;
      locationName = locationLookup.formattedName;
    } else {
      // 2. FALLBACK SAFETY NET: If the user inputs total gibberish, fall back safely to a default hub
      console.log(
        `⚠️ Typo unresolvable for "${rawUserRegion}". Applying Accra fallback safeguards.`,
      );
      lat = 5.6037;
      lng = -0.187;
      locationName = "Accra, Greater Accra (Fallback Baseline)";
    }

    const currentCrop = user.currentCrop || "Maize";
    const fieldSize = user.fieldSize || 2.5;

    // Same window, rainfall annualisation, and coordinates as the map path.
    const assessment = await assessCoordinates(lat, lng, {
      start: req.query.start,
      end: req.query.end,
    });

    return res.json(
      toPersonalResponse(assessment, {
        searchedQuery: rawUserRegion,
        locationName,
        lat,
        lng,
        currentCrop,
        fieldSize,
      }),
    );
  } catch (err) {
    return sendAssessmentError(res, err);
  }
}
