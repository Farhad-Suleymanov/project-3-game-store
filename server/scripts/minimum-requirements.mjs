const majorPublisherPattern = /activision|atlus|bandai namco|bethesda|blizzard|capcom|cd projekt|electronic arts|epic games|focus entertainment|konami|microsoft|nacon|nintendo|paradox|playstation|rockstar|sega|sony|square enix|take-two|thq nordic|ubisoft|warner bros|wb games|xbox/i;

const lowDemandGenres = new Set([
  "card-board-game", "music", "pinball", "point-and-click", "puzzle",
  "quiz-trivia", "visual-novel"
]);
const moderatelyLightGenres = new Set(["arcade", "platform"]);
const cpuHeavyGenres = new Set([
  "real-time-strategy-rts", "simulator", "strategy", "turn-based-strategy-tbs"
]);
const demandingGenres = new Set(["fighting", "racing", "shooter", "sport"]);
const demandingTags = new Set(["open-world", "sandbox", "survival", "warfare"]);

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, maximum) {
  return Math.max(0, Math.min(maximum, value));
}

function choose(options, key) {
  return options[stableHash(key) % options.length];
}

export function hasWindowsPcRelease(game) {
  return (game.platforms || []).some((item) => item?.platform?.slug === "pc");
}

function eraIndex(year) {
  if (!Number.isFinite(year)) return 4;
  if (year <= 1999) return 0;
  if (year <= 2005) return 1;
  if (year <= 2010) return 2;
  if (year <= 2014) return 3;
  if (year <= 2018) return 4;
  if (year <= 2022) return 5;
  return 6;
}

function unavailableRequirements(note) {
  return {
    platform: "PC",
    available_on_pc: false,
    os: null,
    cpu: null,
    gpu: null,
    ram: null,
    storage: null,
    directx: null,
    architecture: null,
    network: null,
    sound_card: null,
    additional_notes: null,
    estimated_profile: null,
    estimated_for_release_year: null,
    source_type: "not-applicable",
    source_url: null,
    source_checked_at: null,
    is_official: false,
    note
  };
}

export function minimumRequirementsForGame(game, config) {
  const official = config.official_games?.[game.slug];
  if (official) {
    return {
      platform: "PC",
      available_on_pc: true,
      ...official,
      estimated_profile: null,
      estimated_for_release_year: null,
      source_type: "steam-official",
      source_checked_at: config.snapshot_date,
      is_official: true,
      note: "Official minimum PC requirements from the linked Steam Store page."
    };
  }

  if (!hasWindowsPcRelease(game)) {
    return unavailableRequirements(config.not_applicable_note);
  }

  const year = Number(game.release_year || String(game.released || "").slice(0, 4));
  const genres = new Set((game.genres || []).map((item) => item.slug));
  const tags = new Set((game.tags || []).map((item) => item.slug));
  const companies = [
    ...(game.publishers || []).map((item) => item.name),
    ...(game.developers || []).map((item) => item.name)
  ].join(" ");
  const isMajor = majorPublisherPattern.test(companies);
  const isIndie = genres.has("indie");
  const isLowDemand = [...lowDemandGenres].some((slug) => genres.has(slug));
  const isModeratelyLight = [...moderatelyLightGenres].some((slug) => genres.has(slug));
  const isCpuHeavy = [...cpuHeavyGenres].some((slug) => genres.has(slug));
  const isDemanding = [...demandingGenres].some((slug) => genres.has(slug))
    || [...demandingTags].some((slug) => tags.has(slug));
  const isOpenWorld = tags.has("open-world") || tags.has("sandbox");
  const maximum = config.profiles.length - 1;
  const base = eraIndex(year);

  let cpu = base;
  let gpu = base;
  let memory = base;
  let storage = base;

  if (isIndie) {
    cpu -= 1;
    gpu -= 2;
    memory -= 1;
    storage -= 1;
  }
  if (isLowDemand) {
    cpu -= 2;
    gpu -= 3;
    memory -= 2;
    storage -= 3;
  } else if (isModeratelyLight) {
    gpu -= 1;
    storage -= 1;
  }
  if (isCpuHeavy && !isLowDemand) cpu += 1;
  if (isOpenWorld) storage += 1;
  if (base >= 6 && isMajor && isDemanding && !isIndie) {
    cpu += 1;
    gpu += 1;
    memory += 1;
    storage += 1;
  }

  cpu = clamp(cpu, maximum);
  gpu = clamp(gpu, maximum);
  memory = clamp(memory, maximum);
  storage = clamp(storage, maximum);

  const era = config.profiles[base];
  const cpuProfile = config.profiles[cpu];
  const gpuProfile = config.profiles[gpu];
  const memoryProfile = config.profiles[memory];
  const storageProfile = config.profiles[storage];
  const onlineNamePattern = /online|multiplayer|counter-strike|call of duty|battlefield|fortnite|valorant|overwatch|league of legends|dota|world of warcraft|guild wars|final fantasy xiv|elder scrolls online/i;
  const needsNetwork = genres.has("moba") || onlineNamePattern.test(game.name);
  const performanceLabel = isLowDemand
    ? "lightweight"
    : isCpuHeavy
      ? "cpu-focused"
      : isDemanding
        ? "graphics-focused"
        : isIndie
          ? "indie"
          : "mainstream";

  return {
    platform: "PC",
    available_on_pc: true,
    os: choose(era.os_options, `${game.slug}:os`),
    cpu: choose(cpuProfile.cpu_options, `${game.slug}:cpu`),
    gpu: choose(gpuProfile.gpu_options, `${game.slug}:gpu`),
    ram: choose(memoryProfile.ram_options, `${game.slug}:ram`),
    storage: choose(storageProfile.storage_options, `${game.slug}:storage`),
    directx: gpuProfile.directx,
    architecture: base >= 3
      ? "64-bit processor and operating system"
      : "32-bit or 64-bit processor and operating system",
    network: needsNetwork ? "Broadband Internet connection" : null,
    sound_card: "DirectX-compatible sound card",
    additional_notes: base >= 5 ? "SSD recommended for faster loading." : null,
    estimated_profile: `${era.id}-${performanceLabel}`,
    estimated_for_release_year: Number.isFinite(year) ? year : null,
    source_type: "catalog-estimate",
    source_url: null,
    source_checked_at: config.snapshot_date,
    is_official: false,
    note: config.estimate_note
  };
}
