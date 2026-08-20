import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { after, before, test } from "node:test";
import supertest from "supertest";
import { createApp } from "../src/app.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogOverrides = JSON.parse(
  readFileSync(path.join(serverRoot, "data", "catalog-overrides.json"), "utf8")
);
const priceConfig = JSON.parse(
  readFileSync(path.join(serverRoot, "data", "price-overrides.json"), "utf8")
);
const minimumRequirementsConfig = JSON.parse(
  readFileSync(path.join(serverRoot, "data", "minimum-requirements.json"), "utf8")
);
const snapshotGames = JSON.parse(
  gunzipSync(readFileSync(path.join(serverRoot, "data", "snapshot", "games.json.gz"))).toString("utf8")
);
const gamesBySlug = new Map(snapshotGames.map((game) => [game.slug, game]));
const wordCount = (value = "") => String(value)
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .length;
const hasWindowsPcRelease = (game) => (game.platforms || [])
  .some((item) => item?.platform?.slug === "pc");
let app;
let request;

before(async () => {
  app = await createApp({
    databasePath: path.join(serverRoot, "database", "game-catalog.sqlite"),
    corsOrigins: ["http://localhost:5173"]
  });
  request = supertest(app);
});

after(() => {
  app.locals.database.close();
});

test("health and metadata describe the local snapshot", async () => {
  const health = await request.get("/api/health").expect(200);
  assert.equal(health.body.status, "ok");

  const metadata = await request.get("/api/meta").expect(200);
  assert.equal(metadata.body.catalog_count, 1500);
  assert.equal(metadata.body.runtime_external_api_required, false);
  assert.equal(metadata.body.source, "IGDB");
  assert.equal(metadata.body.source_games_with_screenshots, 1477);
  assert.equal(metadata.body.games_with_screenshots, 1500);
  assert.equal(metadata.body.popularity_ranked_games, 62);
  assert.equal(metadata.body.landscape_card_images, 0);
  assert.equal(metadata.body.promotional_artwork_card_images, 1500);
  assert.equal(metadata.body.portrait_cover_images, 1500);
  assert.equal(metadata.body.curated_card_image_overrides, 88);
  assert.equal(metadata.body.genre_relationship_overrides, 5);
  assert.equal(metadata.body.price_currency, "USD");
  assert.equal(metadata.body.price_minimum, 0);
  assert.equal(metadata.body.price_maximum, 80);
  assert.equal(metadata.body.storefront_reference_prices, 67);
  assert.equal(metadata.body.estimated_store_prices, 1433);
  assert.equal(metadata.body.free_games, 18);
  assert.equal(metadata.body.paid_catalog_prices, 1482);
  assert.deepEqual(metadata.body.price_endings, ["00", "25", "49", "50", "75", "95", "99"]);
  assert.equal(metadata.body.games_with_50_to_70_word_descriptions, 1500);
  assert.equal(metadata.body.normalized_game_descriptions, 1220);
  assert.equal(metadata.body.description_minimum_words, 50);
  assert.equal(metadata.body.description_maximum_words, 70);
  assert.equal(metadata.body.games_with_3_to_5_screenshots, 1500);
  assert.equal(metadata.body.games_using_gameplay_video_frames, 86);
  assert.equal(metadata.body.gameplay_video_frames, 172);
  assert.equal(metadata.body.screenshot_minimum, 3);
  assert.equal(metadata.body.screenshot_maximum, 5);
  assert.equal(metadata.body.games_with_minimum_requirements, 1500);
  assert.equal(metadata.body.minimum_requirements_are_official, false);
  const pcGames = snapshotGames.filter(hasWindowsPcRelease).length;
  const officialRequirements = Object.keys(minimumRequirementsConfig.official_games).length;
  assert.equal(metadata.body.official_minimum_requirements, officialRequirements);
  assert.equal(metadata.body.estimated_minimum_requirements, pcGames - officialRequirements);
  assert.equal(metadata.body.games_without_pc_requirements, snapshotGames.length - pcGames);
  assert.ok(metadata.body.unique_minimum_requirement_sets >= 50);
});

test("every game has minimum requirements, a 50-70-word description, and 3-5 gameplay screenshots", async () => {
  const sources = new Map();
  const requirementSets = new Set();
  const cpus = new Set();
  const gpus = new Set();
  const storageValues = new Set();

  for (const game of snapshotGames) {
    const requirements = game.minimum_requirements;
    const hasPc = hasWindowsPcRelease(game);
    assert.equal(requirements.platform, "PC");
    assert.equal(requirements.available_on_pc, hasPc);
    sources.set(requirements.source_type, (sources.get(requirements.source_type) || 0) + 1);

    if (!hasPc) {
      assert.equal(requirements.source_type, "not-applicable");
      assert.equal(requirements.is_official, false);
      for (const field of ["os", "cpu", "gpu", "ram", "storage", "directx"]) {
        assert.equal(requirements[field], null);
      }
    } else {
      for (const field of ["os", "cpu", "gpu", "ram", "storage", "directx", "architecture"]) {
        assert.equal(typeof requirements[field], "string");
        assert.ok(requirements[field].length > 0);
      }
      cpus.add(requirements.cpu);
      gpus.add(requirements.gpu);
      storageValues.add(requirements.storage);
      requirementSets.add(JSON.stringify([
        requirements.os, requirements.cpu, requirements.gpu,
        requirements.ram, requirements.storage, requirements.directx
      ]));

      const official = minimumRequirementsConfig.official_games[game.slug];
      if (official) {
        assert.equal(requirements.source_type, "steam-official");
        assert.equal(requirements.is_official, true);
        for (const [field, value] of Object.entries(official)) {
          assert.equal(requirements[field], value);
        }
      } else {
        assert.equal(requirements.source_type, "catalog-estimate");
        assert.equal(requirements.is_official, false);
        assert.ok(requirements.estimated_profile);
      }
    }
    const words = wordCount(game.description);
    assert.ok(words >= 50 && words <= 70, `${game.name} has ${words} description words`);
    assert.equal(game.description_word_count, words);
    assert.ok(game.screenshots.length >= 3 && game.screenshots.length <= 5, `${game.name} has ${game.screenshots.length} screenshots`);
    assert.equal(game.screenshot_count, game.screenshots.length);
    assert.equal(new Set(game.screenshots.map((screenshot) => screenshot.image)).size, game.screenshots.length);
    for (const screenshot of game.screenshots) {
      assert.ok(screenshot.image.startsWith("https://"));
      assert.equal(screenshot.is_gameplay_image, true);
      assert.ok(["igdb-screenshot", "gameplay-video-frame"].includes(screenshot.source_type));
    }
  }

  const pcGames = snapshotGames.filter(hasWindowsPcRelease).length;
  const officialRequirements = Object.keys(minimumRequirementsConfig.official_games).length;
  assert.equal(sources.get("steam-official"), officialRequirements);
  assert.equal(sources.get("catalog-estimate"), pcGames - officialRequirements);
  assert.equal(sources.get("not-applicable"), snapshotGames.length - pcGames);
  assert.ok(requirementSets.size >= 50);
  assert.ok(cpus.size >= 10);
  assert.ok(gpus.size >= 10);
  assert.ok(storageValues.size >= 15);

  const response = await request.get("/api/games?page_size=100").expect(200);
  for (const game of response.body.results) {
    assert.ok(["steam-official", "catalog-estimate", "not-applicable"].includes(game.minimum_requirements.source_type));
    assert.ok(wordCount(game.description) >= 50 && wordCount(game.description) <= 70);
    assert.ok(game.screenshots.length >= 3 && game.screenshots.length <= 5);
  }
});

test("default catalog starts with popular games and store-style artwork", async () => {
  const response = await request.get("/api/games?page_size=10").expect(200);
  assert.deepEqual(
    response.body.results.slice(0, 4).map((game) => game.name),
    [
      "Grand Theft Auto V",
      "Counter-Strike 2",
      "Red Dead Redemption 2",
      "The Witcher 3: Wild Hunt"
    ]
  );

  for (const game of response.body.results.slice(0, 4)) {
    assert.match(game.cover_image, /\/t_cover_big\//);
    assert.match(game.cover_image_highres, /\/t_cover_big_2x\//);
    assert.ok(Number.isInteger(game.popularity_rank));
  }
});

test("curated card images and GTA genre corrections are exposed", async () => {
  const curatedImages = Object.entries(catalogOverrides)
    .filter(([, override]) => override.card_image);
  assert.equal(curatedImages.length, 88);

  for (const [slug, override] of curatedImages) {
    const game = gamesBySlug.get(slug);
    assert.ok(game, `Missing curated game ${slug}`);
    const response = await request.get(`/api/games/${game.id}`).expect(200);
    assert.equal(response.body.background_image, override.card_image);
    assert.equal(response.body.background_image_highres, override.card_image_highres || override.card_image);
    assert.equal(response.body.artwork_image, override.card_image);
    assert.equal(response.body.image_type, "curated-artwork");
  }

  const gtaGames = snapshotGames.filter((game) => game.slug.startsWith("grand-theft-auto"));
  assert.equal(gtaGames.length, 5);
  for (const game of gtaGames) {
    const response = await request.get(`/api/games/${game.id}`).expect(200);
    assert.equal(response.body.genres.some((genre) => genre.slug === "racing"), false);
  }

  const racing = await request
    .get("/api/games?genres=racing&search=grand%20theft%20auto&page_size=100")
    .expect(200);
  assert.equal(racing.body.count, 0);
});

test("games endpoint uses a RAWG-like paginated response", async () => {
  const response = await request.get("/api/games?page=2&page_size=10").expect(200);
  assert.equal(response.body.count, 1500);
  assert.equal(response.body.page, 2);
  assert.equal(response.body.page_size, 10);
  assert.equal(response.body.results.length, 10);
  assert.match(response.body.next, /page=3/);
  assert.match(response.body.previous, /page=1/);
  assert.ok(response.body.results[0].background_image.startsWith("https://"));
});

test("search is case-insensitive and token based", async () => {
  const response = await request.get("/api/games?search=WITCHER&page_size=100").expect(200);
  assert.ok(response.body.count >= 2);
  assert.ok(response.body.results.some((game) => game.name === "The Witcher 3: Wild Hunt"));
});

test("genre and date filters work together", async () => {
  const response = await request
    .get("/api/games?genres=shooter&dates=2025-01-01,2025-12-31&page_size=100")
    .expect(200);
  assert.ok(response.body.count > 0);
  for (const game of response.body.results) {
    assert.ok(game.genres.some((genre) => genre.slug === "shooter"));
    assert.ok(game.released >= "2025-01-01" && game.released <= "2025-12-31");
  }
});

test("multiple parent platforms use AND semantics", async () => {
  const response = await request
    .get("/api/games?parent_platforms=PC,PlayStation,Xbox&page_size=100")
    .expect(200);
  assert.ok(response.body.count > 0);
  for (const game of response.body.results) {
    const parents = new Set(game.parent_platforms.map((item) => item.platform.slug));
    assert.ok(parents.has("pc"));
    assert.ok(parents.has("playstation"));
    assert.ok(parents.has("xbox"));
  }
});

test("rating, name, price, and release ordering are global", async () => {
  const cases = [
    ["-rating", (a, b) => a.rating >= b.rating],
    ["name", (a, b) => a.name.localeCompare(b.name) <= 0],
    ["price", (a, b) => a.price <= b.price],
    ["-released", (a, b) => a.released >= b.released]
  ];

  for (const [ordering, ordered] of cases) {
    const response = await request.get(`/api/games?ordering=${ordering}&page_size=50`).expect(200);
    for (let index = 1; index < response.body.results.length; index += 1) {
      assert.ok(ordered(response.body.results[index - 1], response.body.results[index]), `${ordering} failed at ${index}`);
    }
  }
});

test("USD prices come from the API and support an inclusive range filter", async () => {
  const expectedPrices = new Map([
    ["grand-theft-auto-v", 29.25],
    ["counter-strike-2", 0],
    ["baldurs-gate-iii", 59.49],
    ["stardew-valley", 14.95]
  ]);

  for (const [slug, expectedPrice] of expectedPrices) {
    const game = gamesBySlug.get(slug);
    const response = await request.get(`/api/games/${game.id}`).expect(200);
    assert.equal(response.body.price, expectedPrice);
    assert.equal(response.body.catalog_price, expectedPrice);
    assert.equal(response.body.price_currency, "USD");
    assert.equal(response.body.price_is_live, false);
    assert.equal(response.body.price_formatted, expectedPrice === 0 ? "Free" : `$${expectedPrice.toFixed(2)}`);
  }

  const freeGames = await request.get("/api/games?price_min=0&price_max=0&page_size=100").expect(200);
  assert.equal(freeGames.body.count, 18);
  assert.ok(freeGames.body.results.every((game) => game.price === 0));

  const middleRange = await request.get("/api/games?price_min=20&price_max=30&page_size=100").expect(200);
  assert.ok(middleRange.body.count > 0);
  assert.ok(middleRange.body.results.every((game) => game.price >= 20 && game.price <= 30));

  const priceEndings = new Set(
    snapshotGames
      .filter((game) => game.price > 0)
      .map((game) => Math.round(game.price * 100) % 100)
  );
  assert.deepEqual([...priceEndings].sort((left, right) => left - right), [0, 25, 49, 50, 75, 95, 99]);
});

test("game detail returns extended metadata", async () => {
  const search = await request.get("/api/games?search=witcher&page_size=10").expect(200);
  const game = search.body.results.find((item) => item.name === "The Witcher 3: Wild Hunt");
  const response = await request.get(`/api/games/${game.id}`).expect(200);
  assert.equal(response.body.name, "The Witcher 3: Wild Hunt");
  assert.ok(wordCount(response.body.description) >= 50 && wordCount(response.body.description) <= 70);
  assert.ok(response.body.developers.length > 0);
  assert.ok(response.body.publishers.length > 0);
  assert.ok(response.body.screenshots.length >= 3 && response.body.screenshots.length <= 5);
  assert.equal(response.body.minimum_requirements.source_type, "steam-official");
  assert.equal(response.body.minimum_requirements.is_official, true);
  for (const [field, value] of Object.entries(minimumRequirementsConfig.official_games[game.slug])) {
    assert.equal(response.body.minimum_requirements[field], value);
  }
  assert.equal(response.body.price, 39.49);
  assert.equal(response.body.price_is_real, false);
  assert.equal(response.body.price_is_estimate, true);
  assert.equal(response.body.price_is_live, false);
  assert.equal(response.body.price_has_storefront_reference, true);
  assert.equal(response.body.storefront_reference_price, priceConfig.games[game.slug].price);
  assert.equal(response.body.storefront_reference_source, priceConfig.games[game.slug].source);
  assert.ok(response.body.source.url.startsWith("https://www.igdb.com/"));
});

test("bad queries and missing games return JSON errors", async () => {
  const badPage = await request.get("/api/games?page=0").expect(400);
  assert.equal(badPage.body.error.status, 400);

  await request.get("/api/games?page_size=101").expect(400);
  await request.get("/api/games?dates=2026-12-31,2026-01-01").expect(400);
  await request.get("/api/games?ordering=unknown-order").expect(400);
  await request.get("/api/games?price_min=-1").expect(400);
  await request.get("/api/games?price_max=80.01").expect(400);
  await request.get("/api/games?price_min=40&price_max=20").expect(400);

  const missing = await request.get("/api/games/999999999").expect(404);
  assert.equal(missing.body.error.message, "Game not found.");
  await request.get("/api/does-not-exist").expect(404);
});

test("configured local frontend receives a CORS header", async () => {
  const response = await request
    .get("/api/health")
    .set("Origin", "http://localhost:5173")
    .expect(200);
  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:5173");
});
