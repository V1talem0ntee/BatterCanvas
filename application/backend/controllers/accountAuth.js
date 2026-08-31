const { pool } = require("../db");
const { hashPassword, userResponse } = require("./auth");

function clean(value) {
  return String(value || "").trim();
}


function normalized(value) {
  return clean(value).toLowerCase();
}

function matches(actual, expected) {
  return normalized(actual) === normalized(expected);
}

const wewantitquick = "@bbedu.com";
const newstudentLevel = "freshman";

function bbeduemail(email) {
  const value = normalized(email);
  return (
    value.endsWith(wewantitquick) &&
    value.length > wewantitquick.length &&
    !value.slice(0, -wewantitquick.length).includes("@") &&
    !/\s/.test(value)
  );
}

function EZSignup(externalId, institutionalEmail) {
  const email = normalized(institutionalEmail);
  const emailName = email.slice(0, -wewantitquick.length);

  return {
    external_id: externalId,
    institutional_email: email,
    user_role: "student",
    first_name: emailName || "BBEdu",
    last_name: "Test User",
    zip_code: "00000",
    phone_number: null,
  };
}


async function activateAccount(req, res) {
  const externalId = clean(req.body.id);
  const institutionalEmail = clean(req.body.institutionalEmail);
  const password = req.body.password;

  if (
    !externalId ||
    !institutionalEmail ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    return res.status(400).json({
      message:
        "id, institutionalEmail, and an 8+ character password are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const usebbedu = bbeduemail(institutionalEmail);
    let invitation;

    if (usebbedu) {
      invitation = EZSignup(externalId, institutionalEmail);
    } else {
      const result = await client.query(
        `SELECT *
         FROM public.account_invitation
         WHERE external_id = $1
           AND LOWER(institutional_email) = LOWER($2)
         FOR UPDATE`,
        [externalId, institutionalEmail]
      );

      invitation = result.rows[0];

      if (!invitation || invitation.claimed_at) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "An available account invitation was not found.",
        });
      }
    }

    const school = await client.query(
      "SELECT school_id FROM public.school ORDER BY school_id LIMIT 1"
    );

    if (!school.rows.length) {
      throw new Error("No school record exists.");
    }

    let degreeProgramId = null;

    if (usebbedu && invitation.user_role === "student") {
      const degreeProgram = await client.query(
        `SELECT dp.degree_program_id
         FROM public.degree_program dp
         JOIN public.major m ON m.major_id = dp.major_id
         JOIN public.department d ON d.department_id = m.department_id
         WHERE d.school_id = $1
           AND LOWER(m.major_name) = 'computer science'
           AND UPPER(dp.degree_type) = 'BS'
         ORDER BY dp.catalog_year DESC, dp.degree_program_id DESC
         LIMIT 1`,
        [school.rows[0].school_id]
      );

      if (!degreeProgram.rows.length) {
        throw new Error(
          "Computer Science BS degree program is not configured."
        );
      }

      degreeProgramId = degreeProgram.rows[0].degree_program_id;
    }

    const username =
      invitation.user_role === "admin"
        ? invitation.external_id
        : null;

    const created = await client.query(
      [
        "INSERT INTO public.app_user",
        "(school_id, username, institutional_email, password_hash,",
        "first_name, last_name, user_role, created_at)",
        "VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)",
        "RETURNING user_id, username, institutional_email,",
        "first_name, last_name, user_role",
      ].join(" "),
      [
        school.rows[0].school_id,
        username,
        invitation.institutional_email,
        hashPassword(password),
        invitation.first_name,
        invitation.last_name,
        invitation.user_role,
      ]
    );

    const user = created.rows[0];
    user.external_id = invitation.external_id;

    if (invitation.user_role === "student") {
      await client.query(
        `INSERT INTO public.student
         (student_id, school_student_id, zip_code, phone_number,
          degree_program_id, academic_level)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.user_id,
          invitation.external_id,
          invitation.zip_code,
          invitation.phone_number,
          degreeProgramId,
          newstudentLevel,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO public.admin
         (admin_id, institutional_employee_id)
         VALUES ($1, $2)`,
        [user.user_id, invitation.external_id]
      );
    }

    await client.query(
      `INSERT INTO public.notification
       (user_id, notification_type, title, message)
       VALUES ($1, 'admin-message', 'Welcome to BBEdu',
         'Your account was created successfully.')`,
      [user.user_id]
    );

    if (!usebbedu) {
      await client.query(
        `UPDATE public.account_invitation
         SET claimed_at = CURRENT_TIMESTAMP
         WHERE invitation_id = $1`,
        [invitation.invitation_id]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      user: userResponse(user),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        message: "This account has already been activated.",
      });
    }

    console.error("Account activation failed:", error.message);

    return res.status(500).json({
      message: "Unable to activate account.",
    });
  } finally {
    client.release();
  }
}

module.exports = {
  activateAccount,
  bbeduemail,
  newstudentLevel,
};
