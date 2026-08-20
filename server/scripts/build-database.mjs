import { gunzipSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = path.join(serverRoot, "data", "snapshot", "games.json.gz");
const metadataPath = path.join(serverRoot, "data", "snapshot", "metadata.json");
const outputPath = path.join(serverRoot, "database", "game-catalog.sqlite");
const wasmDirectory = path.dirname(require.resolve("sql.js/dist/sql-wasm.wasm"));

const normalizeSearch = (value = "") => String(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/gi, " ")
  .trim()
  .toLowerCase();

const games = JSON.parse(gunzipSync(readFileSync(snapshotPath)).toString("utf8"));
const snapshotMetadata = JSON.parse(readFileSync(metadataPath, "utf8"));
if (!Array.isArray(games) || games.length < 1000) {
  throw new Error("The snapshot must contain at least 1,000 games.");
}

const SQL = await initSqlJs({ locateFile: (file) => path.join(wasmDirectory, file) });
const database = new SQL.Database();

database.run(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE games (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    released TEXT NOT NULL,
    rating REAL NOT NULL,
    catalog_price REAL NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0,
    popularity_rank INTEGER,
    search_text TEXT NOT NULL,
    data_json TEXT NOT NULL
  );

  CREATE TABLE genres (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE
  );

  CREATE TABLE game_genres (
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, genre_id)
  );

  CREATE TABLE platforms (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE
  );

  CREATE TABLE game_platforms (
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, platform_id)
  );

  CREATE TABLE parent_platforms (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE
  );

  CREATE TABLE game_parent_platforms (
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    parent_platform_id INTEGER NOT NULL REFERENCES parent_platforms(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, parent_platform_id)
  );

  CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX games_name_index ON games(name COLLATE NOCASE);
  CREATE INDEX games_rating_index ON games(rating);
  CREATE INDEX games_released_index ON games(released);
  CREATE INDEX games_price_index ON games(catalog_price);
  CREATE INDEX games_featured_index ON games(featured);
  CREATE INDEX games_popularity_rank_index ON games(popularity_rank);
  CREATE INDEX game_genres_game_index ON game_genres(game_id);
  CREATE INDEX game_genres_genre_index ON game_genres(genre_id);
  CREATE INDEX game_platforms_game_index ON game_platforms(game_id);
  CREATE INDEX game_parent_platforms_game_index ON game_parent_platforms(game_id);
  CREATE INDEX game_parent_platforms_parent_index ON game_parent_platforms(parent_platform_id);
`);

const insertGame = database.prepare(`
  INSERT INTO games (
    id, name, slug, released, rating, catalog_price, featured,
    popularity_rank, search_text, data_json
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertGenre = database.prepare("INSERT OR IGNORE INTO genres (id, name, slug) VALUES (?, ?, ?)");
const insertGameGenre = database.prepare("INSERT OR IGNORE INTO game_genres (game_id, genre_id) VALUES (?, ?)");
const insertPlatform = database.prepare("INSERT OR IGNORE INTO platforms (id, name, slug) VALUES (?, ?, ?)");
const insertGamePlatform = database.prepare("INSERT OR IGNORE INTO game_platforms (game_id, platform_id) VALUES (?, ?)");
const insertParent = database.prepare("INSERT OR IGNORE INTO parent_platforms (id, name, slug) VALUES (?, ?, ?)");
const insertGameParent = database.prepare("INSERT OR IGNORE INTO game_parent_platforms (game_id, parent_platform_id) VALUES (?, ?)");
const insertMetadata = database.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");

database.run("BEGIN TRANSACTION");
try {
  for (const game of games) {
    const searchable = normalizeSearch([
      game.name,
      game.slug,
      game.short_description,
      game.description,
      ...game.genres.map((item) => item.name),
      ...game.developers.map((item) => item.name),
      ...game.publishers.map((item) => item.name),
      ...game.tags.map((item) => item.name)
    ].join(" "));

    insertGame.run([
      game.id,
      game.name,
      game.slug,
      game.released,
      game.rating,
      game.catalog_price,
      game.featured ? 1 : 0,
      Number.isInteger(game.popularity_rank) ? game.popularity_rank : null,
      searchable,
      JSON.stringify(game)
    ]);

    for (const genre of game.genres) {
      insertGenre.run([genre.id, genre.name, genre.slug]);
      insertGameGenre.run([game.id, genre.id]);
    }

    for (const wrapped of game.platforms) {
      const platform = wrapped.platform;
      insertPlatform.run([platform.id, platform.name, platform.slug]);
      insertGamePlatform.run([game.id, platform.id]);
    }

    for (const wrapped of game.parent_platforms) {
      const parent = wrapped.platform;
      insertParent.run([parent.id, parent.name, parent.slug]);
      insertGameParent.run([game.id, parent.id]);
    }
  }

  const metadata = {
    ...snapshotMetadata,
    catalog_count: games.length,
    api_shape: "RAWG-compatible list wrapper with locally sourced game objects",
    runtime_external_api_required: false,
    price_note: "price and catalog_price are static USD regular/base-price references or deterministic storefront-style estimates; they are not live sale prices"
  };
  for (const [key, value] of Object.entries(metadata)) insertMetadata.run([key, JSON.stringify(value)]);
  database.run("COMMIT");
} catch (error) {
  database.run("ROLLBACK");
  throw error;
} finally {
  insertGame.free();
  insertGenre.free();
  insertGameGenre.free();
  insertPlatform.free();
  insertGamePlatform.free();
  insertParent.free();
  insertGameParent.free();
  insertMetadata.free();
}

database.run("VACUUM");
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, Buffer.from(database.export()));
database.close();

console.log(`Created ${outputPath} with ${games.length} games.`);
