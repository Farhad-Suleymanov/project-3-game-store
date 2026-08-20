import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configuredDatabasePath = process.env.DATABASE_PATH || "database/game-catalog.sqlite";

export const config = {
  port: Number(process.env.PORT) || 3000,
  databasePath: path.isAbsolute(configuredDatabasePath)
    ? configuredDatabasePath
    : path.resolve(serverRoot, configuredDatabasePath),
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};
