import Farm from "../models/Farm.js";

export async function getMyFarm(req, res) {
  try {
    const userId = req.user.userId;
    let farm = await Farm.findOne({ userId });

    if (!farm) {
      farm = await Farm.create({
        userId,
        locationName: "Primary Agro-Field",
        lat: 5.6037,
        lng: -0.187,
        currentCrop: "Maize",
        fieldSize: 2.5,
      });
    }

    res.json({ success: true, farm });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateMyFarm(req, res) {
  try {
    const userId = req.user.userId;
    const { locationName, lat, lng, currentCrop, fieldSize } = req.body;
    console.log(req.body)

    let farm = await Farm.findOne({ userId });

    if (farm) {
      farm.locationName = locationName ?? farm.locationName;
      farm.lat = lat !== undefined ? parseFloat(lat) : farm.lat;
      farm.lng = lng !== undefined ? parseFloat(lng) : farm.lng;
      farm.currentCrop = currentCrop ?? farm.currentCrop;
      farm.fieldSize =
        fieldSize !== undefined ? parseFloat(fieldSize) : farm.fieldSize;
      await farm.save();
    } else {
      farm = await Farm.create({
        userId,
        locationName: locationName || "Primary Agro-Field",
        lat: lat ? parseFloat(lat) : 5.6037,
        lng: lng ? parseFloat(lng) : -0.187,
        currentCrop: currentCrop,
        fieldSize: fieldSize ? parseFloat(fieldSize) : 2.5,
      });
    }

    res.json({
      success: true,
      message: "Farm profile updated successfully",
      farm,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
