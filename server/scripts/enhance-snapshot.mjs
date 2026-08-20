import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = path.join(serverRoot, "data", "snapshot", "games.json.gz");
const metadataPath = path.join(serverRoot, "data", "snapshot", "metadata.json");
const popularityPath = path.join(serverRoot, "data", "popularity-order.json");
const overridesPath = path.join(serverRoot, "data", "catalog-overrides.json");
const pricesPath = path.join(serverRoot, "data", "price-overrides.json");

const normalize = (value = "") => String(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’‘]/g, "'")
  .replace(/[^a-z0-9]+/gi, " ")
  .trim()
  .toLowerCase();

function imageWithSize(url, size) {
  if (!url) return null;
  return url.replace(/\/t_[^/]+\//, `/t_${size}/`);
}

const games = JSON.parse(gunzipSync(readFileSync(snapshotPath)).toString("utf8"));
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const popularTitles = JSON.parse(readFileSync(popularityPath, "utf8"));
const catalogOverrides = JSON.parse(readFileSync(overridesPath, "utf8"));
const priceConfig = JSON.parse(readFileSync(pricesPath, "utf8"));
const popularityByTitle = new Map(
  popularTitles.map((title, index) => [normalize(title), index + 1])
);
const gamesByTitle = new Map(games.map((game) => [normalize(game.name), game]));
const gamesBySlug = new Map(games.map((game) => [game.slug, game]));

const standardPriceTiers = {
  legacy: [4.99, 9.99, 14.99, 19.99],
  older: [9.99, 14.99, 19.99, 24.99],
  established: [14.99, 19.99, 24.99, 29.99, 39.99],
  recentBudget: [9.99, 14.99, 19.99, 24.99, 29.99, 39.99],
  recentIndie: [14.99, 19.99, 24.99, 29.99, 39.99],
  recentMajor: [29.99, 39.99, 49.99, 59.99],
  newIndie: [19.99, 24.99, 29.99, 39.99, 49.99],
  newMajor: [39.99, 49.99, 59.99, 69.99]
};

const catalogPriceEndings = [0, 0.25, 0.49, 0.5, 0.75, 0.95, 0.99];

const majorPublisherPattern = /activision|atlus|bandai namco|bethesda|blizzard|capcom|cd projekt|electronic arts|epic games|focus entertainment|konami|microsoft|nacon|nintendo|paradox|playstation|rockstar|sega|sony|square enix|take-two|thq nordic|ubisoft|warner bros|wb games|xbox/i;

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function estimatedPrice(game) {
  const companies = [
    ...(game.publishers || []).map((item) => item.name),
    ...(game.developers || []).map((item) => item.name)
  ].join(" ");
  const isMajor = majorPublisherPattern.test(companies);
  const genreSlugs = new Set(game.genres.map((genre) => genre.slug));
  const isIndie = genreSlugs.has("indie");
  const isBudgetGenre = ["arcade", "card-board-game", "pinball", "point-and-click", "puzzle", "visual-novel"]
    .some((slug) => genreSlugs.has(slug));
  const year = Number(game.release_year || String(game.released).slice(0, 4));
  let tiers;

  if (year <= 2005) tiers = standardPriceTiers.legacy;
  else if (year <= 2012) tiers = standardPriceTiers.older;
  else if (year <= 2020) tiers = standardPriceTiers.established;
  else if (year <= 2024) {
    tiers = isBudgetGenre
      ? standardPriceTiers.recentBudget
      : isMajor && !isIndie
        ? standardPriceTiers.recentMajor
        : standardPriceTiers.recentIndie;
  } else {
    tiers = isBudgetGenre
      ? standardPriceTiers.recentBudget
      : isMajor && !isIndie
        ? standardPriceTiers.newMajor
        : standardPriceTiers.newIndie;
  }

  const qualityOffset = game.rating >= 4.5 ? 2 : game.rating >= 4 ? 1 : 0;
  return tiers[(stableHash(game.slug) + qualityOffset) % tiers.length];
}

function variedCatalogPrice(game, basePrice) {
  if (basePrice === 0) return 0;
  const ending = catalogPriceEndings[
    stableHash(`${game.slug}:catalog-price-ending`) % catalogPriceEndings.length
  ];
  return Number(Math.min(priceConfig.maximum, Math.floor(basePrice) + ending).toFixed(2));
}

const missingPopularTitles = popularTitles.filter((title) => !gamesByTitle.has(normalize(title)));
if (missingPopularTitles.length) {
  throw new Error(`Popular titles missing from the snapshot: ${missingPopularTitles.join(", ")}`);
}

const missingOverrideSlugs = Object.keys(catalogOverrides).filter((slug) => !gamesBySlug.has(slug));
if (missingOverrideSlugs.length) {
  throw new Error(`Catalog override games missing from the snapshot: ${missingOverrideSlugs.join(", ")}`);
}

const priceOverrides = priceConfig.games || {};
const missingPriceSlugs = Object.keys(priceOverrides).filter((slug) => !gamesBySlug.has(slug));
if (missingPriceSlugs.length) {
  throw new Error(`Price override games missing from the snapshot: ${missingPriceSlugs.join(", ")}`);
}

for (const [slug, override] of Object.entries(priceOverrides)) {
  if (!Number.isFinite(override.price)
    || override.price < priceConfig.minimum
    || override.price > priceConfig.maximum) {
    throw new Error(`Price override ${slug} must be between ${priceConfig.minimum} and ${priceConfig.maximum}.`);
  }
}

let promotionalArtworkCardImages = 0;
let portraitCoverImages = 0;
let curatedCardImageOverrides = 0;
let storefrontReferencePrices = 0;
let estimatedStorePrices = 0;
let freeGames = 0;
let paidCatalogPrices = 0;

for (const game of games) {
  const existingArtwork = game.artwork_image || game.background_image;
  const existingCover = game.cover_image;
  const preferredCardImage = existingArtwork || existingCover;

  if (!preferredCardImage) throw new Error(`${game.name} has no usable card image.`);

  game.artwork_image = imageWithSize(existingArtwork, "720p");
  game.cover_image = imageWithSize(existingCover, "cover_big");
  game.cover_image_highres = imageWithSize(existingCover, "cover_big_2x");
  game.background_image = imageWithSize(preferredCardImage, "720p");
  game.background_image_highres = imageWithSize(preferredCardImage, "1080p");
  game.image_type = existingArtwork ? "artwork" : "cover";
  game.popularity_rank = popularityByTitle.get(normalize(game.name)) ?? null;

  const priceOverride = priceOverrides[game.slug];
  const hasStorefrontReference = Boolean(
    priceOverride && !priceOverride.source.startsWith("Estimated")
  );
  const basePrice = priceOverride?.price ?? estimatedPrice(game);
  const price = variedCatalogPrice(game, basePrice);
  const priceIsExact = price === 0 && hasStorefrontReference;
  game.catalog_price = price;
  game.price = price;
  game.price_formatted = price === 0 ? "Free" : `$${price.toFixed(2)}`;
  game.price_currency = priceConfig.currency;
  game.price_source = priceIsExact
    ? priceOverride.source
    : hasStorefrontReference
      ? `Catalog estimate based on ${priceOverride.source}`
      : "Estimated storefront tier";
  game.price_store_url = priceOverride?.url ?? null;
  game.price_checked_at = priceIsExact ? priceConfig.snapshot_date : null;
  game.price_is_real = priceIsExact;
  game.price_is_estimate = !priceIsExact;
  game.price_is_live = false;
  game.price_has_storefront_reference = hasStorefrontReference;
  game.storefront_reference_price = hasStorefrontReference ? priceOverride.price : null;
  game.storefront_reference_price_formatted = hasStorefrontReference
    ? priceOverride.price === 0
      ? "Free"
      : `$${priceOverride.price.toFixed(2)}`
    : null;
  game.storefront_reference_source = hasStorefrontReference ? priceOverride.source : null;
  game.storefront_reference_checked_at = hasStorefrontReference ? priceConfig.snapshot_date : null;

  if (hasStorefrontReference) storefrontReferencePrices += 1;
  else estimatedStorePrices += 1;
  if (price === 0) freeGames += 1;
  else paidCatalogPrices += 1;

  const override = catalogOverrides[game.slug];
  if (override?.card_image) {
    game.artwork_image = override.card_image;
    game.background_image = override.card_image;
    game.background_image_highres = override.card_image_highres || override.card_image;
    game.image_type = "curated-artwork";
    curatedCardImageOverrides += 1;
  }

  if (override?.remove_genres?.length) {
    const removedGenres = new Set(override.remove_genres);
    game.genres = game.genres.filter((genre) => !removedGenres.has(genre.slug));
  }

  if (existingArtwork) promotionalArtworkCardImages += 1;
  if (existingCover) portraitCoverImages += 1;
}

games.sort((left, right) => {
  const leftRank = left.popularity_rank ?? Number.MAX_SAFE_INTEGER;
  const rightRank = right.popularity_rank ?? Number.MAX_SAFE_INTEGER;
  return leftRank - rightRank
    || Number(right.featured) - Number(left.featured)
    || right.rating - left.rating
    || left.name.localeCompare(right.name)
    || left.id - right.id;
});

const enhancedMetadata = {
  ...metadata,
  popularity_ranked_games: popularTitles.length,
  default_popularity_leaders: popularTitles.slice(0, 4),
  landscape_card_images: 0,
  promotional_artwork_card_images: promotionalArtworkCardImages,
  portrait_cover_images: portraitCoverImages,
  curated_card_image_overrides: curatedCardImageOverrides,
  genre_relationship_overrides: Object.values(catalogOverrides)
    .reduce((count, override) => count + (override.remove_genres?.length || 0), 0),
  price_currency: priceConfig.currency,
  price_minimum: priceConfig.minimum,
  price_maximum: priceConfig.maximum,
  price_snapshot_date: priceConfig.snapshot_date,
  storefront_reference_prices: storefrontReferencePrices,
  estimated_store_prices: estimatedStorePrices,
  free_games: freeGames,
  paid_catalog_prices: paidCatalogPrices,
  price_endings: catalogPriceEndings.map((ending) => ending.toFixed(2).slice(-2)),
  price_policy: "Free-to-play prices remain exact; paid catalog prices use deterministic varied USD endings anchored to curated storefront references or age, publisher, genre, and rating tiers; prices are static and are not live sales",
  card_image_policy: "User-curated storefront art for explicit overrides, then official promotional artwork, then official portrait cover; gameplay screenshots are detail-only",
  card_image_sizes: ["source-native", "720p", "1080p", "cover_big", "cover_big_2x"]
};

writeFileSync(snapshotPath, gzipSync(Buffer.from(JSON.stringify(games)), { level: 9 }));
writeFileSync(metadataPath, `${JSON.stringify(enhancedMetadata, null, 2)}\n`);

console.log(JSON.stringify({
  games: games.length,
  popularityRankedGames: popularTitles.length,
  promotionalArtworkCardImages,
  portraitCoverImages,
  curatedCardImageOverrides,
  storefrontReferencePrices,
  estimatedStorePrices,
  freeGames,
  paidCatalogPrices,
  firstFour: games.slice(0, 4).map((game) => game.name)
}, null, 2));
