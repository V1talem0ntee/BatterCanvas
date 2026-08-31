const crypto = require("crypto");


const TOKEN_TTL_SECONDS = 8 * 60 * 60;
// Revocation is process-local and only retained until a token expires. A
// persistent revocation list would need to be stored in the database.
const revokedTokens = new Map();


function tokenSecret() {
  return (
    process.env.AUTH_TOKEN_SECRET ||
    "development-only-change-me"
  );
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}


function sign(payload) {
  return crypto
    .createHmac("sha256", tokenSecret())
    .update(payload)
    .digest("base64url");
}


function createToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({
    userId: user.user_id,
    role: user.user_role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  });

 
  return payload + "." + sign(payload);
}


function removeExpiredRevokedTokens(now) {
  for (const [token, expiresAt] of revokedTokens.entries()) {
    if (expiresAt <= now) {
      revokedTokens.delete(token);
    }
  }
}

function isTokenRevoked(token) {
  const now = Math.floor(Date.now() / 1000);
  removeExpiredRevokedTokens(now);

  const expiresAt = revokedTokens.get(token);
  return Boolean(expiresAt && expiresAt > now);
}

function revokeToken(token, decodedToken) {
  if (!token || !decodedToken?.exp) {
    return;
  }

  revokedTokens.set(token, decodedToken.exp);
}

function verifyToken(token) {
  const [payload, signature] = String(token || "").split(".");

  if (!payload || !signature) {
    return null;
  }

  // Constant-time comparison avoids revealing partial signature matches.
  const actual = Buffer.from(signature);
  const expected = Buffer.from(sign(payload));

  
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  ) {
    return null;
  }


  const decoded = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8")
  );

  // A correct signature is not enough: claims must also have a supported role,
  // a valid lifetime, and a user ID that can be trusted by route middleware.
  if (
    !Number.isInteger(decoded.userId) ||
    decoded.userId <= 0 ||
    !["student", "admin"].includes(decoded.role) ||
    !Number.isInteger(decoded.iat) ||
    !Number.isInteger(decoded.exp) ||
    decoded.exp <= decoded.iat ||
    decoded.exp <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  if (isTokenRevoked(token)) {
    return null;
  }

  return decoded;
}


function requireAuth(req, res, next) {
  try {
    const authorization = req.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    const user = verifyToken(token);

    if (!user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    req.auth = user;
    req.authToken = token;
    return next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}

function requireAdmin(req, res, next) {
  try {
    
    const authorization = req.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    const user = verifyToken(token);

    
    if (!user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    
    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

   
    req.auth = user;
    req.authToken = token;
    return next();
  } catch {
    
    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}

module.exports = {
  createToken,
  verifyToken,
  revokeToken,
  requireAuth,
  requireAdmin,
};
