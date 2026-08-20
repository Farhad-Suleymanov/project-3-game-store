import { createApp } from "./app.js";
import { config } from "./config.js";

try {
  const app = await createApp();
  app.listen(config.port, () => {
    console.log(`Game Catalog API listening at http://localhost:${config.port}/api/games`);
  });
} catch (error) {
  console.error("Unable to start the Game Catalog API.");
  console.error(error);
  process.exitCode = 1;
}
