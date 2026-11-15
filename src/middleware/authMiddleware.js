import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/jwtSecret.js";

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, error: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded; // { userId, email }
    next();
  } catch (err) {
    if (err.code === "JWT_SECRET_MISSING") throw err;
    return res
      .status(403)
      .json({ success: false, error: "Invalid or expired token." });
  }
}
