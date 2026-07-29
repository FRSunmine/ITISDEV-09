import { rmSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { createDatabase } from "../server/database.js";

const dataDirectory = resolve("data");
const databasePath = resolve(process.env.DATABASE_PATH || "data/sidequest.db");
const relativePath = relative(dataDirectory, databasePath);

if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Database reset is restricted to files inside the project data directory.");
}

for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
}

const db = createDatabase(databasePath);
db.close();

console.log(`SideQuest database reset and seeded: ${databasePath}`);
