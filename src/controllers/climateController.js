import User from "../models/User.js";
import {
  fetchNasaPowerData,
  getMlRecommendation,
  getSmartCropRecommendation,
  lookupCoordinates,
} from "../services/nasaPowerService.js";
import Farm from "../models/Farm.js";

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

    // 3. Call your hybrid function which queries BOTH NASA POWER and OpenWeatherMap concurrently
    const hybridResult = await getSmartCropRecommendation(lat, lng);

    // 4. Return complete unified response package to dashboard client interface
    return res.json({
      success: true,
      dataSource: hybridResult.dataSource,
      farmDetails: {
        locationName,
        coordinates: { lat, lng },
        currentCrop,
        fieldSize: `${fieldSize} Hectares`,
      },
      climateSummary: {
        averageTemperatureC: parseFloat(hybridResult.telemetry.avgTemp),
        totalPrecipitationMm: parseFloat(hybridResult.telemetry.totalRain),
        averageSolarRadiation: parseFloat(hybridResult.telemetry.avgSolar),
      },
      // 5. Now safely passing real-time OpenWeatherMap metrics to your client dashboard
      liveWeather: hybridResult.liveWeather || null, 
      aiRecommendation: {
        suggestedAdaptiveCrop: hybridResult.recommendation.name,
        confidenceScore: "Dynamic Leaf Assessment",
        reasoning: hybridResult.recommendation.reasoning,
        modelEngine: "ml-cart in-memory decision tree (True ML / 16-Hub Scaled Framework)",
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}


// Import the lookup function alongside your other modules

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

    const { start, end } = req.query;
    const formattedStart = start ? start.replace(/-/g, "") : "20250101";
    const formattedEnd = end ? end.replace(/-/g, "") : "20251231";

    // 3. Fetch real agroclimatic satellite datasets for resolved positions
    const nasaData = await fetchNasaPowerData(
      lat,
      lng,
      formattedStart,
      formattedEnd,
    );
    const properties = nasaData?.properties?.parameter || {};

    const temps = Object.values(properties.T2M || {}).filter(
      (val) => val !== -999,
    );
    const rains = Object.values(properties.PRECTOTCORR || {}).filter(
      (val) => val !== -999,
    );
    const solars = Object.values(properties.ALLSKY_SFC_SW_DWN || {}).filter(
      (val) => val !== -999,
    );

    if (!temps.length || !rains.length || !solars.length) {
      return res.status(422).json({
        success: false,
        error:
          "NASA POWER data is unavailable for resolved spatial layouts. Please refine registration details.",
      });
    }

    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const totalRain = rains.reduce((a, b) => a + b, 0);
    const avgSolar = solars.reduce((a, b) => a + b, 0) / solars.length;

    // 4. TRUE ML INFERENCE
    const aiResult = getMlRecommendation(avgTemp, totalRain, avgSolar);

    return res.json({
      success: true,
      farm: {
        searchedQuery: rawUserRegion,
        resolvedLocation: locationName,
        coordinates: { lat, lng },
        currentCrop,
        fieldSize,
      },
      climateSummary: {
        averageTemperatureC: parseFloat(avgTemp.toFixed(1)),
        totalPrecipitationMm: parseFloat(totalRain.toFixed(1)),
        averageSolarRadiation: parseFloat(avgSolar.toFixed(2)),
      },
      aiRecommendation: {
        crop: aiResult.name,
        confidenceScore: "Dynamic Leaf Assessment",
        reasoning: aiResult.reasoning,
        model:
          "ml-cart in-memory decision tree (True ML / 16-Hub Scaled Framework)",
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
