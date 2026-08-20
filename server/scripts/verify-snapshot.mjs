import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = path.join(serverRoot, "data", "snapshot", "games.json.gz");
const overridesPath = path.join(serverRoot, "data", "catalog-overrides.json");
const pricesPath = path.join(serverRoot, "data", "price-overrides.json");
const minimumRequirementsPath = path.join(serverRoot, "data", "minimum-requirements.json");
const games = JSON.parse(gunzipSync(readFileSync(snapshotPath)).toString("utf8"));
const catalogOverrides = JSON.parse(readFileSync(overridesPath, "utf8"));
const priceConfig = JSON.parse(readFileSync(pricesPath, "utf8"));
const minimumRequirements = JSON.parse(readFileSync(minimumRequirementsPath, "utf8"));
const errors = [];
const ids = new Set();
const names = new Set();
const popularityRanks = new Set();
const requirementSets = new Set();
const requirementCpuValues = new Set();
const requirementGpuValues = new Set();
const requirementStorageValues = new Set();
const requirementProfiles = new Set();
const requirementSourceCounts = new Map();
const expectedLeaders = [
  "Grand Theft Auto V",
  "Counter-Strike 2",
  "Red Dead Redemption 2",
  "The Witcher 3: Wild Hunt"
];

const wordCount = (value = "") => String(value)
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .length;

const hasWindowsPcRelease = (game) => (game.platforms || [])
  .some((item) => item?.platform?.slug === "pc");

if (games.length < 1000) errors.push(`Expected at least 1,000 games, found ${games.length}.`);

for (const [index, game] of games.entries()) {
  const label = `games[${index}]`;
  for (const field of [
    "id", "name", "slug", "description", "released", "background_image",
    "background_image_highres", "artwork_image", "cover_image",
    "cover_image_highres", "image_type", "rating",
    "genres", "platforms", "screenshots", "screenshot_count",
    "description_word_count", "catalog_price", "price", "price_formatted",
    "price_currency", "price_source", "price_is_real", "price_is_estimate",
    "price_is_live", "price_has_storefront_reference", "minimum_requirements"
  ]) {
    if (game[field] === undefined || game[field] === null || game[field] === "") errors.push(`${label} is missing ${field}.`);
  }
  if (ids.has(game.id)) errors.push(`Duplicate id ${game.id}.`);
  ids.add(game.id);
  const normalizedName = game.name.toLowerCase();
  if (names.has(normalizedName)) errors.push(`Duplicate display name ${game.name}.`);
  names.add(normalizedName);
  if (!(game.rating > 0 && game.rating <= 5)) errors.push(`${label} has invalid rating ${game.rating}.`);
  const actualDescriptionWords = wordCount(game.description);
  if (actualDescriptionWords < 50 || actualDescriptionWords > 70) {
    errors.push(`${label} has ${actualDescriptionWords} description words.`);
  }
  if (game.description_word_count !== actualDescriptionWords) {
    errors.push(`${label} has an incorrect description_word_count.`);
  }
  const requirements = game.minimum_requirements;
  const sourceType = requirements?.source_type;
  requirementSourceCounts.set(sourceType, (requirementSourceCounts.get(sourceType) || 0) + 1);
  const hasPc = hasWindowsPcRelease(game);
  if (requirements?.available_on_pc !== hasPc) {
    errors.push(`${label} has incorrect PC requirement availability.`);
  }
  if (!requirements || requirements.platform !== "PC" || typeof requirements.is_official !== "boolean") {
    errors.push(`${label} has an invalid minimum requirement object.`);
  } else if (sourceType === "not-applicable") {
    if (hasPc || requirements.is_official) errors.push(`${label} incorrectly marks requirements not applicable.`);
    for (const field of ["os", "cpu", "gpu", "ram", "storage", "directx"]) {
      if (requirements[field] !== null) errors.push(`${label} has ${field} requirements without a Windows PC release.`);
    }
  } else {
    if (!hasPc) errors.push(`${label} has PC requirements without a Windows PC release.`);
    for (const field of ["os", "cpu", "gpu", "ram", "storage", "directx", "architecture"]) {
      if (typeof requirements[field] !== "string" || !requirements[field]) {
        errors.push(`${label} has an invalid requirement field ${field}.`);
      }
    }
    requirementCpuValues.add(requirements.cpu);
    requirementGpuValues.add(requirements.gpu);
    requirementStorageValues.add(requirements.storage);
    requirementSets.add(JSON.stringify([
      requirements.os, requirements.cpu, requirements.gpu,
      requirements.ram, requirements.storage, requirements.directx
    ]));
    if (sourceType === "steam-official") {
      if (!requirements.is_official || !requirements.source_url?.startsWith("https://store.steampowered.com/")) {
        errors.push(`${label} has invalid official requirement provenance.`);
      }
      const configured = minimumRequirements.official_games?.[game.slug];
      if (!configured) errors.push(`${label} has an unconfigured official requirement set.`);
      for (const [field, value] of Object.entries(configured || {})) {
        if (requirements[field] !== value) errors.push(`${label} does not preserve official requirement field ${field}.`);
      }
    } else if (sourceType === "catalog-estimate") {
      if (requirements.is_official || requirements.source_url !== null || !requirements.estimated_profile) {
        errors.push(`${label} has invalid estimated requirement provenance.`);
      }
      requirementProfiles.add(requirements.estimated_profile);
    } else {
      errors.push(`${label} has unknown requirement source type ${sourceType}.`);
    }
  }
  if (!Array.isArray(game.screenshots) || game.screenshots.length < 3 || game.screenshots.length > 5) {
    errors.push(`${label} must have between 3 and 5 screenshots.`);
  } else {
    if (game.screenshot_count !== game.screenshots.length) {
      errors.push(`${label} has an incorrect screenshot_count.`);
    }
    const screenshotUrls = new Set();
    for (const screenshot of game.screenshots) {
      if (!screenshot?.image?.startsWith("https://")) {
        errors.push(`${label} has an invalid screenshot URL.`);
      }
      if (screenshotUrls.has(screenshot.image)) {
        errors.push(`${label} contains a duplicate screenshot URL.`);
      }
      screenshotUrls.add(screenshot.image);
      if (screenshot.is_gameplay_image !== true) {
        errors.push(`${label} has a screenshot not identified as gameplay imagery.`);
      }
      if (!["igdb-screenshot", "gameplay-video-frame"].includes(screenshot.source_type)) {
        errors.push(`${label} has an invalid screenshot source type.`);
      }
    }
  }
  if (!Number.isFinite(game.catalog_price)
    || game.catalog_price < priceConfig.minimum
    || game.catalog_price > priceConfig.maximum) {
    errors.push(`${label} has invalid price ${game.catalog_price}.`);
  }
  if (game.price !== game.catalog_price) errors.push(`${label} has mismatched price fields.`);
  if (game.price_currency !== priceConfig.currency) errors.push(`${label} has invalid price currency.`);
  const expectedFormattedPrice = game.price === 0 ? "Free" : `$${game.price.toFixed(2)}`;
  if (game.price_formatted !== expectedFormattedPrice) errors.push(`${label} has invalid formatted price.`);
  if (game.price_is_live !== false) errors.push(`${label} incorrectly identifies its static price as live.`);
  if (game.price_is_real === game.price_is_estimate) errors.push(`${label} has inconsistent price confidence flags.`);

  const priceOverride = priceConfig.games[game.slug];
  const hasStorefrontReference = Boolean(
    priceOverride && !priceOverride.source.startsWith("Estimated")
  );
  if (game.price_has_storefront_reference !== hasStorefrontReference) {
    errors.push(`${label} has an invalid storefront reference flag.`);
  }
  if (hasStorefrontReference) {
    if (game.storefront_reference_price !== priceOverride.price) {
      errors.push(`${label} does not preserve its storefront reference price.`);
    }
    if (game.storefront_reference_source !== priceOverride.source) {
      errors.push(`${label} does not preserve its storefront reference source.`);
    }
  }
  if (game.price === 0 && !game.price_is_real) {
    errors.push(`${label} does not identify its free price as exact.`);
  }
  if (game.price > 0 && !game.price_is_estimate) {
    errors.push(`${label} does not identify its varied catalog price as an estimate.`);
  }
  const override = catalogOverrides[game.slug];
  if (override?.card_image) {
    if (game.background_image !== override.card_image) errors.push(`${label} does not use its curated card image.`);
    if (game.background_image_highres !== (override.card_image_highres || override.card_image)) {
      errors.push(`${label} does not use its curated high-resolution card image.`);
    }
    if (game.artwork_image !== override.card_image) errors.push(`${label} does not expose its curated artwork image.`);
    if (game.image_type !== "curated-artwork") errors.push(`${label} does not identify its curated artwork.`);
  } else {
    if (!game.background_image.startsWith("https://images.igdb.com/")) errors.push(`${label} has an unexpected image source.`);
    if (!game.background_image.includes("/t_720p/")) errors.push(`${label} does not use a 720p card image.`);
    if (!game.background_image_highres.includes("/t_1080p/")) errors.push(`${label} does not include a 1080p card image.`);
  }
  if (!game.cover_image.includes("/t_cover_big/")) errors.push(`${label} does not include a portrait cover.`);
  if (!game.cover_image_highres.includes("/t_cover_big_2x/")) errors.push(`${label} does not include a high-resolution portrait cover.`);
  if (!["artwork", "cover", "curated-artwork"].includes(game.image_type)) errors.push(`${label} has invalid image_type ${game.image_type}.`);
  if (["artwork", "curated-artwork"].includes(game.image_type) && game.background_image !== game.artwork_image) {
    errors.push(`${label} does not use its promotional artwork as the card image.`);
  }
  for (const removedGenre of override?.remove_genres || []) {
    if (game.genres.some((genre) => genre.slug === removedGenre)) {
      errors.push(`${label} still contains removed genre ${removedGenre}.`);
    }
  }
  if (game.slug.startsWith("grand-theft-auto") && game.genres.some((genre) => genre.slug === "racing")) {
    errors.push(`${label} is a GTA game that still contains the Racing genre.`);
  }
  if (game.popularity_rank !== null) {
    if (!Number.isInteger(game.popularity_rank) || game.popularity_rank < 1) {
      errors.push(`${label} has invalid popularity_rank ${game.popularity_rank}.`);
    } else if (popularityRanks.has(game.popularity_rank)) {
      errors.push(`Duplicate popularity_rank ${game.popularity_rank}.`);
    }
    popularityRanks.add(game.popularity_rank);
  }
  if (!game.source?.url || !game.source?.snapshot_commit) errors.push(`${label} is missing provenance.`);
}

const actualLeaders = [...games]
  .filter((game) => game.popularity_rank !== null)
  .sort((left, right) => left.popularity_rank - right.popularity_rank)
  .slice(0, expectedLeaders.length)
  .map((game) => game.name);
if (JSON.stringify(actualLeaders) !== JSON.stringify(expectedLeaders)) {
  errors.push(`Unexpected popularity leaders: ${actualLeaders.join(", ")}.`);
}

for (const slug of Object.keys(catalogOverrides)) {
  if (!games.some((game) => game.slug === slug)) errors.push(`Override target ${slug} is missing.`);
}

for (const slug of Object.keys(priceConfig.games)) {
  if (!games.some((game) => game.slug === slug)) errors.push(`Price override target ${slug} is missing.`);
}

for (const slug of Object.keys(minimumRequirements.official_games || {})) {
  if (!games.some((game) => game.slug === slug)) errors.push(`Official requirement target ${slug} is missing.`);
}

if ((requirementSourceCounts.get("steam-official") || 0) !== Object.keys(minimumRequirements.official_games || {}).length) {
  errors.push("Official minimum requirement count does not match the configuration.");
}
if ((requirementSourceCounts.get("catalog-estimate") || 0) < 1000) {
  errors.push("Too few games have estimated PC requirements.");
}
if ((requirementSourceCounts.get("not-applicable") || 0) < 1) {
  errors.push("No non-PC games are marked not applicable.");
}
if (requirementSets.size < 50 || requirementCpuValues.size < 10
  || requirementGpuValues.size < 10 || requirementStorageValues.size < 15
  || requirementProfiles.size < 8) {
  errors.push("Minimum requirements do not have enough realistic variation.");
}

const paidPriceEndings = new Set(
  games
    .filter((game) => game.price > 0)
    .map((game) => Math.round(game.price * 100) % 100)
);
for (const expectedEnding of [0, 25, 49, 50, 75, 95, 99]) {
  if (!paidPriceEndings.has(expectedEnding)) errors.push(`Paid prices are missing the ${expectedEnding} cent ending.`);
}

if (errors.length) {
  console.error(errors.slice(0, 50).join("\n"));
  console.error(`Snapshot validation failed with ${errors.length} error(s).`);
  process.exitCode = 1;
} else {
  console.log(`Snapshot is valid: ${games.length} unique games with minimum requirements, 50-70-word descriptions, 3-5 gameplay screenshots, store-style artwork, and provenance.`);
}
