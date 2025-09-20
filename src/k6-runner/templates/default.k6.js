// File: src/k6-runner/templates/default.k6.js

import http from "k6/http";
import { check, sleep, group } from "k6";

// --- PLACEHOLDERS ---
const SCENARIOS_OBJECT = __SCENARIOS_OBJECT__;
const THRESHOLDS_OBJECT = __THRESHOLDS_OBJECT__;
// --- END PLACEHOLDERS ---

let extractedVars = {};

export const options = {
  scenarios: SCENARIOS_OBJECT,
  thresholds: THRESHOLDS_OBJECT,
};

function getJsonValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((o, k) => (o || {})[k], obj);
}

function replacePlaceholders(target, vars) {
  let jsonString = JSON.stringify(target);
  jsonString = jsonString.replace(
    /\{\{\$randomInt\((\d+),(\d+)\)\}\}/g,
    (_, min, max) =>
      Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) +
      parseInt(min)
  );
  jsonString = jsonString.replace(
    /\{\{(\w+)\}\}/g,
    (_, varName) => vars[varName] || ""
  );
  return JSON.parse(jsonString);
}

// --- INJECTED TEST FUNCTIONS WILL GO HERE ---
__INJECTED_TEST_FUNCTIONS__;
