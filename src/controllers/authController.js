import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

export async function register(req, res) {
  try {
    const { email, password, name, region } = req.body;
    if (!email || !password || !name || !region) {
      return res
        .status(400)
        .json({ success: false, error: "All fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "Email is already registered." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email,
      password: passwordHash,
      name: name,
      AgriculturalRegion: region,
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7h" },
    );

    res.json({
      success: true,
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
