import { HttpError } from "./http-error.js";

export function singleQueryValue(value, name) {
  if (Array.isArray(value)) throw new HttpError(400, `Query parameter "${name}" must be provided once.`);
  return value;
}

export function positiveInteger(value, name, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const raw = singleQueryValue(value, name);
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(String(raw))) throw new HttpError(400, `Query parameter "${name}" must be a positive integer.`);
  const parsed = Number(raw);
  if (parsed < 1 || parsed > maximum) {
    throw new HttpError(400, `Query parameter "${name}" must be between 1 and ${maximum}.`);
  }
  return parsed;
}

export function numberInRange(value, name, minimum, maximum) {
  const raw = singleQueryValue(value, name);
  if (raw === undefined || raw === "") return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(raw))) {
    throw new HttpError(400, `Query parameter "${name}" must be a number with at most two decimal places.`);
  }
  const parsed = Number(raw);
  if (parsed < minimum || parsed > maximum) {
    throw new HttpError(400, `Query parameter "${name}" must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

export function csvValues(value, name) {
  const raw = singleQueryValue(value, name);
  if (raw === undefined || raw === "") return [];
  return [...new Set(String(raw).split(",").map((item) => item.trim()).filter(Boolean))];
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function dateRange(value) {
  const raw = singleQueryValue(value, "dates");
  if (raw === undefined || raw === "") return null;
  const parts = String(raw).split(",").map((part) => part.trim());
  if (parts.length !== 2 || !parts.every(validIsoDate)) {
    throw new HttpError(400, "Query parameter \"dates\" must use YYYY-MM-DD,YYYY-MM-DD.");
  }
  if (parts[0] > parts[1]) throw new HttpError(400, "The start date cannot be after the end date.");
  return { start: parts[0], end: parts[1] };
}

export function normalizeSearch(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function normalizeSlug(value = "") {
  return normalizeSearch(value).replace(/\s+/g, "-");
}
