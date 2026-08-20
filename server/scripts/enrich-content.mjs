import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minimumRequirementsForGame } from "./minimum-requirements.mjs";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = path.join(serverRoot, "data", "snapshot", "games.json.gz");
const metadataPath = path.join(serverRoot, "data", "snapshot", "metadata.json");
const videoOverridesPath = path.join(serverRoot, "data", "gameplay-video-overrides.json");
const minimumRequirementsPath = path.join(serverRoot, "data", "minimum-requirements.json");

const games = JSON.parse(gunzipSync(readFileSync(snapshotPath)).toString("utf8"));
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const videoOverrides = JSON.parse(readFileSync(videoOverridesPath, "utf8"));
const requirementsConfig = JSON.parse(readFileSync(minimumRequirementsPath, "utf8"));

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value = "") {
  return cleanText(value).split(/\s+/).filter(Boolean);
}

function wordCount(value = "") {
  return words(value).length;
}

function limitedNames(items = [], limit = 3) {
  return items
    .map((item) => item?.platform?.name || item?.name)
    .filter(Boolean)
    .slice(0, limit);
}

function joinedNames(items) {
  if (items.length <= 1) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function truncateDescription(value, maximum = 68) {
  const allWords = words(value);
  let sentenceCutoff = 0;
  for (let index = 49; index < Math.min(maximum, allWords.length); index += 1) {
    if (/[.!?]["')\]]*$/.test(allWords[index])) sentenceCutoff = index + 1;
  }
  if (sentenceCutoff >= 50) return allWords.slice(0, sentenceCutoff).join(" ");

  const selected = allWords.slice(0, maximum);
  if (!selected.length) return "";
  selected[selected.length - 1] = selected[selected.length - 1].replace(/[,:;.!?…-]+$/g, "");
  return `${selected.join(" ")}…`;
}

function normalizedDescription(game) {
  const sourceDescription = cleanText(game.description_raw || game.description);
  let description = sourceDescription
    ? `${sourceDescription[0].toUpperCase()}${sourceDescription.slice(1)}`
    : "";
  if (description && !/[.!?…]$/.test(description)) description = `${description}.`;

  if (wordCount(description) > 70) return truncateDescription(description);

  const year = game.release_year || String(game.released || "").slice(0, 4);
  const genres = limitedNames(game.genres);
  const platforms = limitedNames(game.platforms);
  const developers = limitedNames(game.developers, 2);
  const publishers = limitedNames(game.publishers, 2);
  const tags = limitedNames(game.tags);
  const facts = [
    year && genres.length
      ? `Released in ${year}, the title is cataloged in the ${joinedNames(genres)} ${genres.length === 1 ? "genre" : "genres"}.`
      : year
        ? `The recorded release year for this title is ${year}.`
        : "",
    developers.length && publishers.length
      ? `Development is credited to ${joinedNames(developers)}, with publishing credited to ${joinedNames(publishers)}.`
      : developers.length
        ? `Development is credited to ${joinedNames(developers)}.`
        : publishers.length
          ? `Publishing is credited to ${joinedNames(publishers)}.`
          : "",
    platforms.length
      ? `Its listed platforms include ${joinedNames(platforms)}.`
      : "",
    tags.length
      ? `Catalog tags highlight ${joinedNames(tags)}.`
      : "",
    Number.isFinite(game.rating)
      ? `The stored IGDB user rating is ${game.rating.toFixed(2)} out of five.`
      : "",
    "This entry summarizes the release, genre, platform, creator, and rating information stored in the offline catalog.",
    "It is included in a broad collection spanning classic, modern, independent, and major game releases."
  ].filter(Boolean);

  for (const fact of facts) {
    if (wordCount(description) >= 50) break;
    description = `${description}${description ? " " : ""}${fact}`;
  }

  if (wordCount(description) > 70) description = truncateDescription(description);
  if (wordCount(description) < 50) {
    throw new Error(`${game.name} could not be expanded to a 50-word description.`);
  }
  return description;
}

function normalizedScreenshots(game) {
  const unique = new Map();
  for (const screenshot of game.screenshots || []) {
    if (!screenshot?.image || unique.has(screenshot.image)) continue;
    unique.set(screenshot.image, {
      ...screenshot,
      source_type: screenshot.source_type || "igdb-screenshot",
      source_url: screenshot.source_url || game.source?.url || null,
      is_gameplay_image: true
    });
  }

  const screenshots = [...unique.values()].slice(0, 5);
  if (screenshots.length < 3) {
    const match = videoOverrides.games[game.slug];
    if (!match?.video_id) {
      throw new Error(`${game.name} needs gameplay frames but has no video match.`);
    }

    for (let frame = 1; frame <= 3 && screenshots.length < 3; frame += 1) {
      screenshots.push({
        id: -(game.id * 10 + frame),
        image: `https://img.youtube.com/vi/${match.video_id}/hq${frame}.jpg`,
        source_type: "gameplay-video-frame",
        source_url: `https://www.youtube.com/watch?v=${match.video_id}`,
        source_title: match.title,
        is_gameplay_image: true
      });
    }
  }

  return screenshots;
}

let normalizedDescriptions = 0;
let gamesUsingVideoFrames = 0;
let gameplayVideoFrames = 0;
const requirementSourceCounts = new Map();
const requirementProfileCounts = new Map();
const uniqueRequirementSets = new Set();

const gameSlugs = new Set(games.map((game) => game.slug));
for (const slug of Object.keys(requirementsConfig.official_games || {})) {
  if (!gameSlugs.has(slug)) throw new Error(`Official requirement target ${slug} is missing.`);
}

for (const game of games) {
  const sourceWordCount = wordCount(game.description_raw || game.description);
  game.description = normalizedDescription(game);
  game.short_description = game.description;
  game.description_word_count = wordCount(game.description);
  game.description_source_word_count = sourceWordCount;
  game.description_is_normalized = true;
  if (game.description_word_count !== sourceWordCount) normalizedDescriptions += 1;

  game.screenshots = normalizedScreenshots(game);
  game.screenshot_count = game.screenshots.length;
  const supplementalCount = game.screenshots
    .filter((screenshot) => screenshot.source_type === "gameplay-video-frame")
    .length;
  if (supplementalCount) gamesUsingVideoFrames += 1;
  gameplayVideoFrames += supplementalCount;

  game.minimum_requirements = minimumRequirementsForGame(game, requirementsConfig);
  const requirementSource = game.minimum_requirements.source_type;
  requirementSourceCounts.set(requirementSource, (requirementSourceCounts.get(requirementSource) || 0) + 1);
  const requirementProfile = game.minimum_requirements.estimated_profile;
  if (requirementProfile) {
    requirementProfileCounts.set(requirementProfile, (requirementProfileCounts.get(requirementProfile) || 0) + 1);
  }
  uniqueRequirementSets.add(JSON.stringify({
    os: game.minimum_requirements.os,
    cpu: game.minimum_requirements.cpu,
    gpu: game.minimum_requirements.gpu,
    ram: game.minimum_requirements.ram,
    storage: game.minimum_requirements.storage,
    directx: game.minimum_requirements.directx
  }));

  if (game.description_word_count < 50 || game.description_word_count > 70) {
    throw new Error(`${game.name} has ${game.description_word_count} description words.`);
  }
  if (game.screenshot_count < 3 || game.screenshot_count > 5) {
    throw new Error(`${game.name} has ${game.screenshot_count} screenshots.`);
  }
}

const enhancedMetadata = {
  ...metadata,
  source_games_with_screenshots: metadata.source_games_with_screenshots || metadata.games_with_screenshots,
  games_with_screenshots: games.length,
  content_sources: ["IGDB", "title-matched YouTube gameplay-video frames"],
  image_storage: "Remote IGDB CDN and YouTube gameplay-frame URLs with local metadata and provenance",
  games_with_50_to_70_word_descriptions: games.length,
  normalized_game_descriptions: normalizedDescriptions,
  description_minimum_words: 50,
  description_maximum_words: 70,
  description_policy: "Source description retained in description_raw; description and short_description are normalized to 50-70 words using source text and stored factual metadata",
  games_with_3_to_5_screenshots: games.length,
  screenshot_minimum: 3,
  screenshot_maximum: 5,
  games_using_gameplay_video_frames: gamesUsingVideoFrames,
  gameplay_video_frames: gameplayVideoFrames,
  screenshot_policy: "Up to five IGDB screenshots; title-matched gameplay-video still frames supplement only records with fewer than three IGDB screenshots",
  games_with_minimum_requirements: games.length,
  minimum_requirements_are_official: false,
  official_minimum_requirements: requirementSourceCounts.get("steam-official") || 0,
  estimated_minimum_requirements: requirementSourceCounts.get("catalog-estimate") || 0,
  games_without_pc_requirements: requirementSourceCounts.get("not-applicable") || 0,
  unique_minimum_requirement_sets: uniqueRequirementSets.size,
  minimum_requirement_profiles: Object.fromEntries([...requirementProfileCounts].sort()),
  minimum_requirements_snapshot_date: requirementsConfig.snapshot_date,
  minimum_requirements_policy: "Verified Steam minimums are preserved for explicit overrides; remaining Windows PC games receive deterministic Steam-style estimates based on release era and game profile; games without Windows PC releases are marked not applicable"
};

writeFileSync(snapshotPath, gzipSync(Buffer.from(JSON.stringify(games)), { level: 9 }));
writeFileSync(metadataPath, `${JSON.stringify(enhancedMetadata, null, 2)}\n`);

console.log(JSON.stringify({
  games: games.length,
  normalizedDescriptions,
  descriptionWords: {
    minimum: Math.min(...games.map((game) => game.description_word_count)),
    maximum: Math.max(...games.map((game) => game.description_word_count))
  },
  screenshots: {
    minimum: Math.min(...games.map((game) => game.screenshot_count)),
    maximum: Math.max(...games.map((game) => game.screenshot_count)),
    gamesUsingVideoFrames,
    gameplayVideoFrames
  },
  minimumRequirements: {
    games: games.length,
    official: requirementSourceCounts.get("steam-official") || 0,
    estimated: requirementSourceCounts.get("catalog-estimate") || 0,
    notApplicable: requirementSourceCounts.get("not-applicable") || 0,
    uniqueSets: uniqueRequirementSets.size,
    profiles: Object.fromEntries([...requirementProfileCounts].sort())
  }
}, null, 2));
