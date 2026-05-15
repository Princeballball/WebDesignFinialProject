const crypto = require("crypto");
const express = require("express");
const { readDb, updateDb } = require("./storage");

const router = express.Router();

function classroomStudents(classroom) {
  return classroom.students || classroom.studentIds || [];
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

function publicAssignment(assignment) {
  return {
    id: assignment.id,
    classroomId: assignment.classroomId,
    title: assignment.title,
    algorithm: assignment.algorithm,
    dueDate: assignment.dueDate || "",
    teacherId: assignment.teacherId,
    createdAt: assignment.createdAt,
  };
}

router.post("/", async (req, res) => {
  const { requesterId, classroomId, title, algorithm, dueDate = "" } = req.body;
  const db = await readDb();
  const actor = getActor(db, requesterId);
  const classroom = db.classrooms.find((item) => item.id === classroomId);

  if (!classroom) {
    return res.status(404).json({ message: "Classroom not found." });
  }

  if (!canManageClassroom(actor, classroom)) {
    return res.status(403).json({ message: "Only the classroom teacher or admin can assign homework." });
  }

  if (!title || !algorithm) {
    return res.status(400).json({ message: "Title and algorithm are required." });
  }

  const assignment = {
    id: crypto.randomUUID(),
    classroomId,
    title: title.trim(),
    algorithm,
    dueDate,
    teacherId: classroom.teacherId,
    createdAt: new Date().toISOString(),
  };

  await updateDb((currentDb) => ({
    ...currentDb,
    assignments: [...(currentDb.assignments || []), assignment],
  }));

  return res.status(201).json({ assignment: publicAssignment(assignment) });
});

router.patch("/:assignmentId", async (req, res) => {
  const { requesterId, title, algorithm, dueDate = "" } = req.body;
  const db = await readDb();
  const assignment = (db.assignments || []).find((item) => item.id === req.params.assignmentId);

  if (!assignment) {
    return res.status(404).json({ message: "Assignment not found." });
  }

  const classroom = db.classrooms.find((item) => item.id === assignment.classroomId);
  const actor = getActor(db, requesterId);

  if (!canManageClassroom(actor, classroom)) {
    return res.status(403).json({ message: "Only the classroom teacher or admin can edit homework." });
  }

  if (!title || !algorithm) {
    return res.status(400).json({ message: "Title and algorithm are required." });
  }

  const updatedAssignment = {
    ...assignment,
    title: title.trim(),
    algorithm,
    dueDate,
    updatedAt: new Date().toISOString(),
  };

  await updateDb((currentDb) => ({
    ...currentDb,
    assignments: (currentDb.assignments || []).map((item) => (
      item.id === assignment.id ? updatedAssignment : item
    )),
  }));

  return res.json({ assignment: publicAssignment(updatedAssignment) });
});

router.get("/", async (req, res) => {
  const { userId, role, classroomId } = req.query;
  const db = await readDb();
  const actor = getActor(db, userId);

  let assignments = db.assignments || [];

  if (classroomId) {
    assignments = assignments.filter((assignment) => assignment.classroomId === classroomId);
  }

  if (role === "student") {
    const joinedClassIds = db.classrooms
      .filter((classroom) => classroomStudents(classroom).includes(userId))
      .map((classroom) => classroom.id);
    assignments = assignments.filter((assignment) => joinedClassIds.includes(assignment.classroomId));
  } else if (role === "teacher") {
    assignments = assignments.filter((assignment) => {
      const classroom = db.classrooms.find((item) => item.id === assignment.classroomId);
      return classroom && classroom.teacherId === userId;
    });
  } else if (role === "admin") {
    if (!actor || actor.role !== "admin") {
      return res.status(403).json({ message: "Admin permission required." });
    }
  } else {
    return res.status(403).json({ message: "Role is required." });
  }

  const submissions = db.assignmentSubmissions || [];

  return res.json({
    assignments: assignments.map((assignment) => {
      const assignmentSubmissions = submissions.filter((submission) => {
        if (submission.assignmentId !== assignment.id) {
          return false;
        }

        if (role === "student") {
          return submission.studentId === userId;
        }

        return true;
      }).map((submission) => {
        const student = db.users.find((user) => user.id === submission.studentId);
        return {
          ...submission,
          studentEmail: student ? student.email : submission.studentId,
        };
      });

      return {
        ...publicAssignment(assignment),
        submissions: assignmentSubmissions,
      };
    }),
  });
});

router.post("/:assignmentId/submissions", async (req, res) => {
  const { studentId, score, total, answers = [] } = req.body;
  const db = await readDb();
  const assignment = (db.assignments || []).find((item) => item.id === req.params.assignmentId);

  if (!assignment) {
    return res.status(404).json({ message: "Assignment not found." });
  }

  const student = db.users.find((user) => user.id === studentId && user.role === "student");
  const classroom = db.classrooms.find((item) => item.id === assignment.classroomId);

  if (!student || !classroom || !classroomStudents(classroom).includes(studentId)) {
    return res.status(403).json({ message: "Only enrolled students can submit this assignment." });
  }

  if (assignment.dueDate && new Date() > new Date(`${assignment.dueDate}T23:59:59`)) {
    return res.status(400).json({ message: "這份作業已超過截止日期。" });
  }

  const submission = {
    id: crypto.randomUUID(),
    assignmentId: assignment.id,
    classroomId: assignment.classroomId,
    studentId,
    score: Number(score),
    total: Number(total),
    answers,
    submittedAt: new Date().toISOString(),
  };

  await updateDb((currentDb) => ({
    ...currentDb,
    assignmentSubmissions: [
      ...(currentDb.assignmentSubmissions || []).filter(
        (item) => !(item.assignmentId === assignment.id && item.studentId === studentId),
      ),
      submission,
    ],
  }));

  return res.status(201).json({ submission });
});

router.get("/:assignmentId/submissions", async (req, res) => {
  const { requesterId } = req.query;
  const db = await readDb();
  const assignment = (db.assignments || []).find((item) => item.id === req.params.assignmentId);

  if (!assignment) {
    return res.status(404).json({ message: "Assignment not found." });
  }

  const actor = getActor(db, requesterId);
  const classroom = db.classrooms.find((item) => item.id === assignment.classroomId);

  if (!canManageClassroom(actor, classroom)) {
    return res.status(403).json({ message: "Only the classroom teacher or admin can view grades." });
  }

  const submissions = (db.assignmentSubmissions || [])
    .filter((submission) => submission.assignmentId === assignment.id)
    .map((submission) => {
      const student = db.users.find((user) => user.id === submission.studentId);
      return {
        ...submission,
        studentEmail: student ? student.email : "Unknown student",
      };
    });

  return res.json({ submissions });
});

module.exports = router;
