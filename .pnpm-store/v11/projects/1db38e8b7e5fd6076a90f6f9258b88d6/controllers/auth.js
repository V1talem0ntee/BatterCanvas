const crypto = require("crypto");
const { pool } = require("../db");
const { createToken, revokeToken } = require("../middleware/token");

const DEFAULT_SCHOOL_NAME =
  process.env.DEFAULT_SCHOOL_NAME || "San Francisco State University";
const PASSWORD_KEY_LENGTH = 64;


function cleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}


function cleanName(name) {
  return String(name || "").trim();
}


function validPassword(password) {
  return typeof password === "string" && password.length >= 8;
}



function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, PASSWORD_KEY_LENGTH)
    .toString("hex");


  return `scrypt:${salt}:${hash}`;
}


function checkPassword(password, savedPasswordHash) {
  const [type, salt, hash] = String(savedPasswordHash || "").split(":");


  if (type !== "scrypt" || !salt || !hash) {
    return false;
  }

  const inputHash = crypto.scryptSync(
    password,
    salt,
    PASSWORD_KEY_LENGTH
  );
  const savedHash = Buffer.from(hash, "hex");


  return (
    savedHash.length === inputHash.length &&
    crypto.timingSafeEqual(savedHash, inputHash)
  );
}


function userResponse(user) {
  return {
    userId: user.user_id,
    displayId:
      user.external_id || String(user.user_id).padStart(9, "0"),
    externalId: user.external_id || null,
    email: user.institutional_email,
    username: user.username || null,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.user_role,
  };
}


async function getDefaultSchoolId(client) {
  const existingSchool = await client.query(
    "SELECT school_id FROM public.school ORDER BY school_id LIMIT 1"
  );

  if (existingSchool.rows.length > 0) {
    return existingSchool.rows[0].school_id;
  }

  const newSchool = await client.query(
    `INSERT INTO public.school (school_name)
     VALUES ($1)
     RETURNING school_id`,
    [DEFAULT_SCHOOL_NAME]
  );

  return newSchool.rows[0].school_id;
}


async function registerStudent(req, res) {
  const institutionalEmail = cleanEmail(
    req.body.institutionalEmail
  );
  const firstName = cleanName(req.body.firstName);
  const lastName = cleanName(req.body.lastName);
  const password = req.body.password;

  if (
    !institutionalEmail ||
    !firstName ||
    !lastName ||
    !validPassword(password)
  ) {
    return res.status(400).json({
      message:
        "institutionalEmail, firstName, lastName, and an 8+ character password are required.",
    });
  }


  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const schoolId =
      req.body.schoolId || (await getDefaultSchoolId(client));
    const passwordHash = hashPassword(password);

  
    const createdUser = await client.query(
      `INSERT INTO public.app_user (
        school_id,
        institutional_email,
        password_hash,
        first_name,
        last_name,
        user_role,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, 'student', CURRENT_TIMESTAMP)
      RETURNING user_id, institutional_email, first_name, last_name, user_role`,
      [
        schoolId,
        institutionalEmail,
        passwordHash,
        firstName,
        lastName,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      user: userResponse(createdUser.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK");


    if (error.code === "23505") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    return res.status(500).json({
      message: "Unable to register account.",
    });
  } finally {
    
    client.release();
  }
}


async function login(req, res) {
  const identifier = cleanEmail(
    req.body.identifier ||
      req.body.institutionalEmail ||
      req.body.username
  );
  const password = req.body.password;

  if (!identifier || typeof password !== "string") {
    return res.status(400).json({
      message: "identifier and password are required.",
    });
  }

  try {
    
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.institutional_email, u.password_hash,
              u.first_name, u.last_name, u.user_role,
              COALESCE(
                s.school_student_id,
                a.institutional_employee_id
              ) AS external_id
       FROM public.app_user u
       LEFT JOIN public.student s ON s.student_id = u.user_id
       LEFT JOIN public.admin a ON a.admin_id = u.user_id
       WHERE LOWER(u.institutional_email) = $1
          OR LOWER(u.username) = $1
       LIMIT 1`,
      [identifier]
    );

    const user = result.rows[0];

    
    if (!user || !checkPassword(password, user.password_hash)) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    
    await pool.query(
      `UPDATE public.app_user
       SET last_login_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [user.user_id]
    );

    
    return res.json({
      user: userResponse(user),
      token: createToken(user),
    });
  } catch (error) {
   
    console.error("Login failed:", error.message);

    return res.status(500).json({
      message: "Unable to log in.",
    });
  }
}

function getSession(req, res) {
  return res.json({
    userId: req.auth.userId,
    role: req.auth.role,
  });
}


function logout(req, res) {
  revokeToken(req.authToken, req.auth);
  return res.status(204).send();
}
module.exports = {
  registerStudent,
  login,
  getSession,
  logout,
  hashPassword,
  checkPassword,
  userResponse,
};
