import crypto from "node:crypto";

let cachedSecret;

/**
 * Resolve the signing secret from `env` without caching.
 * Production must set JWT_SECRET. Development generates a process-local secret.
 * The raw environment value is kept as-is so an already-configured host (Render)
 * keeps signing with the same secret it has set.
 */
export function resolveJwtSecret(env = process.env) {
  const fromEnv = env.JWT_SECRET;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return { secret: fromEnv, ephemeral: false };
  }

  if (env.NODE_ENV === "production") {
    const error = new Error(
      "JWT_SECRET is required in production. Set JWT_SECRET to a long random string in the environment and restart. Refusing to boot with a built-in default secret.",
    );
    error.code = "JWT_SECRET_MISSING";
    throw error;
  }

  return {
    secret: crypto.randomBytes(32).toString("hex"),
    ephemeral: true,
  };
}

export function resetJwtSecretCache() {
  cachedSecret = undefined;
}

export function getJwtSecret() {
  if (cachedSecret) return cachedSecret;

  const resolved = resolveJwtSecret();
  if (resolved.ephemeral) {
    console.warn("============================================================");
    console.warn("WARNING: JWT_SECRET is not set.");
    console.warn("This process generated an ephemeral random JWT secret.");
    console.warn("Login tokens will stop working when the process exits.");
    console.warn("Set JWT_SECRET in the environment before deploying.");
    console.warn("This fallback is for local development only. Production refuses to start without JWT_SECRET.");
    console.warn("============================================================");
  }

  cachedSecret = resolved.secret;
  return cachedSecret;
}
