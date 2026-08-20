import express from "express";
import cors from "cors";
import { config as defaultConfig } from "./config.js";
import { loadDatabase } from "./database/load-database.js";
import { GamesService } from "./services/games-service.js";
import { GamesController } from "./controllers/games-controller.js";
import { gamesRouter } from "./routes/games.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export async function createApp(options = {}) {
  const runtimeConfig = {
    ...defaultConfig,
    ...options
  };
  const database = await loadDatabase(runtimeConfig.databasePath);
  const service = new GamesService(database);
  const controller = new GamesController(service);
  const app = express();

  app.disable("x-powered-by");
  app.locals.database = database;
  app.use(cors({
    origin(origin, callback) {
      if (!origin || runtimeConfig.corsOrigins.includes("*") || runtimeConfig.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    }
  }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/api/meta", controller.metadata);
  app.use("/api/games", gamesRouter(controller));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
