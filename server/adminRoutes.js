const crypto = require("crypto");
const express = require("express");
const { readDb, updateDb } = require("./storage");

const router = express.Router();
const manageableRoles = new Set(["student", "teacher"]);

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function requireAdmin(adminId) {
  const db = await readDb();
  const admin = db.users.find((user) => user.id === adminId && user.role === "admin");

  if (!admin) {
    const error = new Error("Admin permission required.");
    error.status = 403;
    throw error;
  }

  return db;
}

router.get("/users", async (req, res) => {
  try {
    const db = await requireAdmin(req.query.adminId);
    return res.json({ users: db.users.map(publicUser) });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post("/users", async (req, res) => {
  const { adminId, email, password, role } = req.body;

  if (!email || !password || !manageableRoles.has(role)) {
    return res.status(400).json({ message: "Email, password, and student/teacher role are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  try {
    await requireAdmin(adminId);
    let createdUser;

    await updateDb((db) => {
      const exists = db.users.some((user) => user.email === email && user.role === role);

      if (exists) {
        const error = new Error("This email is already registered for that role.");
        error.status = 409;
        throw error;
      }

      createdUser = {
        id: crypto.randomUUID(),
        email,
        password,
        role,
        createdAt: new Date().toISOString(),
      };

      return {
        ...db,
        users: [...db.users, createdUser],
      };
    });

    return res.status(201).json({ user: publicUser(createdUser) });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.delete("/users/:id", async (req, res) => {
  const { adminId } = req.body;
  const userId = req.params.id;

  try {
    const db = await requireAdmin(adminId);
    const target = db.users.find((user) => user.id === userId);

    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    if (target.role === "admin") {
      return res.status(400).json({ message: "Admin users cannot be deleted here." });
    }

    await updateDb((currentDb) => ({
      ...currentDb,
      users: currentDb.users.filter((user) => user.id !== userId),
      classrooms: currentDb.classrooms.map((classroom) => ({
        ...classroom,
        students: (classroom.students || classroom.studentIds || []).filter((studentId) => studentId !== userId),
        studentIds: undefined,
      })),
      quizResults: currentDb.quizResults.filter((result) => result.userId !== userId),
    }));

    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
