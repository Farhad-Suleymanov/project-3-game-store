import { queryAll, queryOne } from "../database/load-database.js";
import { HttpError } from "../utils/http-error.js";
import {
  csvValues,
  dateRange,
  normalizeSearch,
  normalizeSlug,
  numberInRange,
  positiveInteger,
  singleQueryValue
} from "../utils/query.js";

const popularityOrdering = `
  CASE WHEN g.popularity_rank IS NULL THEN 1 ELSE 0 END ASC,
  g.popularity_rank ASC,
  g.featured DESC,
  g.rating DESC,
  g.name COLLATE NOCASE ASC
`;

const orderingSql = {
  "": popularityOrdering,
  popularity: popularityOrdering,
  name: "g.name COLLATE NOCASE ASC",
  "-name": "g.name COLLATE NOCASE DESC",
  rating: "g.rating ASC, g.name COLLATE NOCASE ASC",
  "-rating": "g.rating DESC, g.name COLLATE NOCASE ASC",
  price: "g.catalog_price ASC, g.name COLLATE NOCASE ASC",
  "-price": "g.catalog_price DESC, g.name COLLATE NOCASE ASC",
  released: "g.released ASC, g.name COLLATE NOCASE ASC",
  "-released": "g.released DESC, g.name COLLATE NOCASE ASC"
};

const parentAliases = new Map([
  ["1", "pc"],
  ["pc", "pc"],
  ["windows", "pc"],
  ["2", "playstation"],
  ["ps", "playstation"],
  ["playstation", "playstation"],
  ["3", "xbox"],
  ["xbox", "xbox"]
]);

const genreAliases = new Map([
  ["rpg", "role-playing-games-rpg"],
  ["role-playing-rpg", "role-playing-games-rpg"],
  ["role-playing-games-rpg", "role-playing-games-rpg"]
]);

function parsedGame(row) {
  const game = JSON.parse(row.data_json);
  return { ...game, price: game.catalog_price };
}

function listGame(row) {
  const game = parsedGame(row);
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    released: game.released,
    background_image: game.background_image,
    background_image_highres: game.background_image_highres,
    artwork_image: game.artwork_image,
    cover_image: game.cover_image,
    cover_image_highres: game.cover_image_highres,
    image_type: game.image_type,
    rating: game.rating,
    ratings_count: game.ratings_count,
    critic_rating: game.critic_rating,
    genres: game.genres,
    platforms: game.platforms,
    parent_platforms: game.parent_platforms,
    description: game.description,
    short_description: game.short_description,
    description_word_count: game.description_word_count,
    screenshots: game.screenshots,
    screenshot_count: game.screenshot_count,
    minimum_requirements: game.minimum_requirements,
    price: game.price,
    catalog_price: game.catalog_price,
    price_formatted: game.price_formatted,
    price_currency: game.price_currency,
    price_source: game.price_source,
    price_store_url: game.price_store_url,
    price_checked_at: game.price_checked_at,
    price_is_real: game.price_is_real,
    price_is_estimate: game.price_is_estimate,
    price_is_live: game.price_is_live,
    price_has_storefront_reference: game.price_has_storefront_reference,
    storefront_reference_price: game.storefront_reference_price,
    storefront_reference_price_formatted: game.storefront_reference_price_formatted,
    storefront_reference_source: game.storefront_reference_source,
    storefront_reference_checked_at: game.storefront_reference_checked_at,
    featured: game.featured,
    popularity_rank: game.popularity_rank
  };
}

function filterParts(query) {
  const clauses = [];
  const parameters = [];

  const search = normalizeSearch(singleQueryValue(query.search, "search") ?? "");
  for (const token of search.split(/\s+/).filter(Boolean)) {
    clauses.push("g.search_text LIKE ?");
    parameters.push(`%${token}%`);
  }

  for (const requestedGenre of csvValues(query.genres, "genres")) {
    const normalized = normalizeSlug(requestedGenre);
    const genre = genreAliases.get(normalized) ?? normalized;
    clauses.push(`EXISTS (
      SELECT 1 FROM game_genres gg
      JOIN genres ge ON ge.id = gg.genre_id
      WHERE gg.game_id = g.id AND ge.slug = ?
    )`);
    parameters.push(genre);
  }

  for (const requestedParent of csvValues(query.parent_platforms, "parent_platforms")) {
    const normalized = normalizeSlug(requestedParent);
    const parent = parentAliases.get(normalized) ?? normalized;
    clauses.push(`EXISTS (
      SELECT 1 FROM game_parent_platforms gp
      JOIN parent_platforms pp ON pp.id = gp.parent_platform_id
      WHERE gp.game_id = g.id AND pp.slug = ?
    )`);
    parameters.push(parent);
  }

  for (const requestedPlatform of csvValues(query.platforms, "platforms")) {
    clauses.push(`EXISTS (
      SELECT 1 FROM game_platforms gpl
      JOIN platforms pl ON pl.id = gpl.platform_id
      WHERE gpl.game_id = g.id AND pl.slug = ?
    )`);
    parameters.push(normalizeSlug(requestedPlatform));
  }

  const dates = dateRange(query.dates);
  if (dates) {
    clauses.push("g.released BETWEEN ? AND ?");
    parameters.push(dates.start, dates.end);
  }

  const priceMin = numberInRange(query.price_min, "price_min", 0, 80);
  const priceMax = numberInRange(query.price_max, "price_max", 0, 80);
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    throw new HttpError(400, "Query parameter \"price_min\" cannot be greater than \"price_max\".");
  }
  if (priceMin !== null) {
    clauses.push("g.catalog_price >= ?");
    parameters.push(priceMin);
  }
  if (priceMax !== null) {
    clauses.push("g.catalog_price <= ?");
    parameters.push(priceMax);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    parameters
  };
}

export class GamesService {
  constructor(database) {
    this.database = database;
  }

  list(query) {
    const page = positiveInteger(query.page, "page", 1);
    const pageSize = positiveInteger(query.page_size, "page_size", 36, 100);
    const ordering = String(singleQueryValue(query.ordering, "ordering") ?? "");
    if (!(ordering in orderingSql)) {
      throw new HttpError(400, `Unsupported ordering. Use one of: ${Object.keys(orderingSql).filter(Boolean).join(", ")}.`);
    }

    const { whereSql, parameters } = filterParts(query);
    const countRow = queryOne(this.database, `SELECT COUNT(*) AS count FROM games g ${whereSql}`, parameters);
    const count = Number(countRow.count);
    const offset = (page - 1) * pageSize;

    const rows = queryAll(
      this.database,
      `SELECT g.data_json
       FROM games g
       ${whereSql}
       ORDER BY ${orderingSql[ordering]}
       LIMIT ? OFFSET ?`,
      [...parameters, pageSize, offset]
    );

    return {
      count,
      page,
      pageSize,
      results: rows.map(listGame)
    };
  }

  detail(idValue) {
    if (!/^\d+$/.test(String(idValue)) || Number(idValue) < 1) {
      throw new HttpError(400, "Game id must be a positive integer.");
    }
    const row = queryOne(this.database, "SELECT data_json FROM games WHERE id = ?", [Number(idValue)]);
    if (!row) throw new HttpError(404, "Game not found.");
    return parsedGame(row);
  }

  metadata() {
    const rows = queryAll(this.database, "SELECT key, value FROM metadata ORDER BY key");
    return Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
  }
}
