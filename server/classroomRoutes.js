const crypto = require("crypto");
const express = require("express");
const { readDb, updateDb } = require("./storage");

const router = express.Router();

function makeClassCode(existingCodes) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";

  while (true) {
    const code = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join("")
      + Array.from({ length: 3 }, () => numbers[Math.floor(Math.random() * numbers.length)]).join("");

    if (!existingCodes.has(code)) {
      return code;
    }
  }
}

function classroomStudents(classroom) {
  return classroom.students || classroom.studentIds || [];
}

function normalizeClassroom(classroom) {
  const { studentIds, ...rest } = classroom;
  return {
    ...rest,
    students: classroomStudents(classroom),
  };
}

function publicClassroom(classroom) {
  return normalizeClassroom(classroom);
}

function getActor(db, actorId) {
  return db.users.find((user) => user.id === actorId);
}

function canManageClassroom(actor, classroom) {
  if (!actor) {
    return false;
  }

  if (actor.role === "admin") {
    return true;
  }

  return actor.role === "teacher" && classroom.teacherId === actor.id;
}

function resolveActorId(req) {
  return req.body.requesterId || req.body.teacherId || req.body.adminId || req.query.requesterId;
}

router.post("/", async (req, res) => {
  const { name, courseName = "", teacherId } = req.body;
  const db = await readDb();
  const teacher = db.users.find((user) => user.id === teacherId && (user.role === "teacher" || user.role === "admin"));

  if (!teacher) {
    return res.status(403).json({ message: "Only teachers or admins can create classrooms." });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Classroom name is required." });
  }

  const classCode = makeClassCode(new Set(db.classrooms.map((classroom) => classroom.classCode)));
  const classroom = {
    id: crypto.randomUUID(),
    name: name.trim(),
    courseName: courseName.trim(),
    teacherId,
    classCode,
    students: [],
    createdAt: new Date().toISOString(),
  };

  await updateDb((currentDb) => ({
    ...currentDb,
    classrooms: [...currentDb.classrooms.map(normalizeClassroom), classroom],
  }));

  return res.status(201).json({ classroom });
});

router.get("/", async (req, res) => {
  const { userId, role } = req.query;
  const db = await readDb();
  const normalizedClassrooms = db.classrooms.map(normalizeClassroom);

  const classrooms = normalizedClassrooms.filter((classroom) => {
    if (role === "admin") {
      return true;
    }

    if (role === "teacher") {
      return classroom.teacherId === userId;
    }

    if (role === "student") {
      return classroom.students.includes(userId);
    }

    return false;
  });

  return res.json({ classrooms: classrooms.map(publicClassroom) });
});

router.post("/join", async (req, res) => {
  const { classCode, studentId } = req.body;
  const normalizedCode = String(classCode || "").trim().toUpperCase();
  const db = await readDb();
  const student = db.users.find((user) => user.id === studentId && user.role === "student");
  const classroom = db.classrooms.map(normalizeClassroom).find((item) => item.classCode === normalizedCode);

  if (!student) {
    return res.status(403).json({ message: "Only students can join classrooms." });
  }

  if (!classroom) {
    return res.status(404).json({ message: "Classroom code was not found." });
  }

  const nextStudents = classroom.students.includes(studentId)
    ? classroom.students
    : [...classroom.students, studentId];

  await updateDb((currentDb) => ({
    ...currentDb,
    classrooms: currentDb.classrooms.map((item) => {
      const normalized = normalizeClassroom(item);

      if (normalized.id !== classroom.id) {
        return normalized;
      }

      return {
        ...normalized,
        students: nextStudents,
      };
    }),
  }));

  return res.json({
    classroom: {
      ...classroom,
      students: nextStudents,
    },
  });
});

router.get("/:classroomId/students", async (req, res) => {
  const db = await readDb();
  const classroom = db.classrooms.map(normalizeClassroom).find((item) => item.id === req.params.classroomId);

  if (!classroom) {
    return res.status(404).json({ message: "Classroom not found." });
  }

  const students = db.users
    .filter((user) => classroom.students.includes(user.id))
    .map((student) => ({
      id: student.id,
      email: student.email,
      role: student.role,
    }));

  const quizResults = db.quizResults.filter((result) => result.classroomId === classroom.id);

  return res.json({ classroom: publicClassroom(classroom), students, quizResults });
});

router.post("/:classroomId/students", async (req, res) => {
  const { studentEmail } = req.body;
  const actorId = resolveActorId(req);
  const db = await readDb();
  const actor = getActor(db, actorId);
  const classroom = db.classrooms.map(normalizeClassroom).find((item) => item.id === req.params.classroomId);

  if (!classroom) {
    return res.status(404).json({ message: "Classroom not found." });
  }

  if (!canManageClassroom(actor, classroom)) {
    return res.status(403).json({ message: "Only the classroom teacher or admin can add students." });
  }

  const matchingUsers = db.users.filter((item) => item.email === studentEmail);
  const user = matchingUsers.find((item) => item.role === "student");

  if (!matchingUsers.length) {
    return res.status(404).json({ message: "找不到此學生帳號" });
  }

  if (!user) {
    return res.status(400).json({ message: "此帳號不是學生" });
  }

  if (classroom.students.includes(user.id)) {
    return res.status(409).json({ message: "學生已在此教室" });
  }

  const updatedClassroom = {
    ...classroom,
    students: [...classroom.students, user.id],
  };

  await updateDb((currentDb) => ({
    ...currentDb,
    classrooms: currentDb.classrooms.map((item) => {
      const normalized = normalizeClassroom(item);
      return normalized.id === classroom.id ? updatedClassroom : normalized;
    }),
  }));

  return res.json({ classroom: publicClassroom(updatedClassroom) });
});

router.delete("/:classroomId/students/:studentId", async (req, res) => {
  const actorId = resolveActorId(req);
  const db = await readDb();
  const actor = getActor(db, actorId);
  const classroom = db.classrooms.map(normalizeClassroom).find((item) => item.id === req.params.classroomId);

  if (!classroom) {
    return res.status(404).json({ message: "Classroom not found." });
  }

  if (!canManageClassroom(actor, classroom)) {
    return res.status(403).json({ message: "Only the classroom teacher or admin can remove students." });
  }

  const updatedClassroom = {
    ...classroom,
    students: classroom.students.filter((id) => id !== req.params.studentId),
  };

  await updateDb((currentDb) => ({
    ...currentDb,
    classrooms: currentDb.classrooms.map((item) => {
      const normalized = normalizeClassroom(item);
      return normalized.id === classroom.id ? updatedClassroom : normalized;
    }),
  }));

  return res.json({ classroom: publicClassroom(updatedClassroom) });
});

module.exports = router;
