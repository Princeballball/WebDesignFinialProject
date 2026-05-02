const crypto = require("crypto");
const express = require("express");
const { readDb, updateDb } = require("./storage");

const router = express.Router();

router.post("/", async (req, res) => {
  const { userId, classroomId = "", algorithm, questionId, selectedAnswer, correctAnswer, isCorrect } = req.body;

  if (!userId || !questionId) {
    return res.status(400).json({ message: "userId and questionId are required." });
  }

  const result = {
    id: crypto.randomUUID(),
    userId,
    classroomId,
    algorithm,
    questionId,
    selectedAnswer,
    correctAnswer,
    isCorrect: Boolean(isCorrect),
    createdAt: new Date().toISOString(),
  };

  await updateDb((db) => ({
    ...db,
    quizResults: [...db.quizResults, result],
  }));

  return res.status(201).json({ result });
});

router.get("/", async (req, res) => {
  const { userId } = req.query;
  const db = await readDb();
  const quizResults = userId
    ? db.quizResults.filter((result) => result.userId === userId)
    : db.quizResults;

  return res.json({ quizResults });
});

module.exports = router;
