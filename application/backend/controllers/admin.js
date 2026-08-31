const { pool } = require("../db");

// 清理前端传入的数据，避免 null、undefined 和首尾空格影响验证。
function clean(value) {
  return String(value || "").trim();
}

// 邮箱统一转为小写，避免大小写不同导致重复账号。
function cleanEmail(value) {
  return clean(value).toLowerCase();
}

// Admin 预先创建一个等待认领的 Student ID 或 Admin ID。
async function createInvitation(req, res) {
  // server.js 使用 /api/admin/:role，因此这里把复数 URL 转成数据库使用的角色名称。
  const role = req.params.role === "students"
    ? "student"
    : req.params.role === "admins"
      ? "admin"
      : "";

  const externalId = clean(role === "student" ? req.body.studentId : req.body.adminId);
  const firstName = clean(req.body.firstName);
  const lastName = clean(req.body.lastName);
  const phoneNumber = clean(req.body.phoneNumber);
  const zipCode = clean(req.body.zipCode);
  const institutionalEmail = cleanEmail(req.body.institutionalEmail);

  // Student 和 Admin 都必须提供外部 ID 与姓名。
  if (!role || !externalId || !firstName || !lastName) {
    return res.status(400).json({
      message: "ID, firstName, and lastName are required.",
    });
  }

  // Student 还需要电话、Zip Code 和学校邮箱，以便注册时进行身份验证。
  if (role === "student" && (!phoneNumber || !zipCode || !institutionalEmail)) {
    return res.status(400).json({
      message: "Student phoneNumber, zipCode, and institutionalEmail are required.",
    });
  }

  try {
    // 使用 $1 到 $8 参数化查询，避免把用户输入直接拼接进 SQL。
    const sql = [
      "INSERT INTO public.account_invitation",
      "(external_id, user_role, first_name, last_name, phone_number, zip_code, institutional_email, created_by)",
      "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      "RETURNING invitation_id, external_id, user_role, first_name, last_name,",
      "phone_number, zip_code, institutional_email, claimed_at, created_at",
    ].join(" ");

    // req.auth.userId 由 requireAdmin 中间件从登录 Token 中取得。
    const result = await pool.query(sql, [
      externalId,
      role,
      firstName,
      lastName,
      phoneNumber || null,
      zipCode || null,
      institutionalEmail || null,
      req.auth.userId,
    ]);

    return res.status(201).json({ invitation: result.rows[0] });
  } catch (error) {
    // PostgreSQL 23505 表示违反唯一约束，通常是 ID 或邮箱已经存在。
    if (error.code === "23505") {
      return res.status(409).json({
        message: "This ID or email already exists.",
      });
    }

    return res.status(500).json({
      message: "Unable to create account invitation.",
    });
  }
}

// 返回所有预创建账号；最新创建的记录排在最前面。
async function listInvitations(req, res) {
  try {
    const sql = [
      "SELECT invitation_id, external_id, user_role, first_name, last_name,",
      "phone_number, zip_code, institutional_email, claimed_at, created_at",
      "FROM public.account_invitation",
      "ORDER BY created_at DESC",
    ].join(" ");

    const result = await pool.query(sql);
    return res.json({ invitations: result.rows });
  } catch {
    return res.status(500).json({
      message: "Unable to list account invitations.",
    });
  }
}

// 只允许删除尚未被用户认领的 invitation。
async function deleteInvitation(req, res) {
  const invitationId = Number(req.params.id);

  if (!Number.isInteger(invitationId) || invitationId <= 0) {
    return res.status(400).json({
      message: "A valid invitation ID is required.",
    });
  }

  try {
    // claimed_at 为 NULL 表示用户尚未完成身份验证和账号激活。
    const result = await pool.query(
      `DELETE FROM public.account_invitation
       WHERE invitation_id = $1
         AND claimed_at IS NULL
       RETURNING invitation_id`,
      [invitationId]
    );

    // 没有返回记录，代表 invitation 不存在或已经被认领。
    if (!result.rows.length) {
      return res.status(404).json({
        message: "Unclaimed invitation not found.",
      });
    }

    return res.status(204).send();
  } catch {
    return res.status(500).json({
      message: "Unable to delete account invitation.",
    });
  }
}

module.exports = {
  createInvitation,
  listInvitations,
  deleteInvitation,
};
