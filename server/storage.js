const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const dbPath = path.join(__dirname, "..", "data", "db.json");
const initialData = {
  users: [],
  classrooms: [],
  quizResults: [],
};

async function ensureDb() {
  try {
    await fs.access(dbPath);
  } catch (error) {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    await fs.writeFile(dbPath, JSON.stringify(initialData, null, 2));
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(dbPath, "utf8");
  const data = JSON.parse(raw);
  return {
    ...initialData,
    ...data,
    classrooms: (data.classrooms || []).map((classroom) => {
      const { studentIds, ...rest } = classroom;
      return {
        ...rest,
        students: classroom.students || studentIds || [],
      };
    }),
  };
}

async function writeDb(data) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
  return data;
}

async function updateDb(updater) {
  const data = await readDb();
  const nextData = await updater(data);
  await writeDb(nextData);
  return nextData;
}

async function seedDefaultAdmin() {
  await updateDb((db) => {
    const hasAdmin = db.users.some((user) => user.email === "admin" && user.role === "admin");

    if (hasAdmin) {
      return db;
    }

    return {
      ...db,
      users: [
        {
          id: crypto.randomUUID(),
          email: "admin",
          password: "yen-1019",
          role: "admin",
          createdAt: new Date().toISOString(),
        },
        ...db.users,
      ],
    };
  });
}

module.exports = {
  readDb,
  writeDb,
  updateDb,
  seedDefaultAdmin,
};
