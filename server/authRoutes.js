const crypto = require("crypto");
const express = require("express");
const { readDb, updateDb } = require("./storage");

const router = express.Router();
const validRoles = new Set(["admin", "student", "teacher"]);
const registerRoles = new Set(["student", "teacher"]);

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

router.post("/register", async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !registerRoles.has(role)) {
    return res.status(400).json({ message: "Email, password, and student/teacher role are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  let createdUser;

  try {
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
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }

  return res.status(201).json({ user: publicUser(createdUser) });
});

router.post("/login", async (req, res) => {
  const { email, password, role } = req.body;
  const db = await readDb();
  const user = db.users.find(
    (item) => item.email === email && item.password === password && item.role === role,
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid email, password, or role." });
  }

  return res.json({ user: publicUser(user) });
});

module.exports = router;
