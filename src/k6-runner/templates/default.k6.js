// File: src/k6-runner/templates/default.k6.js

import http from "k6/http";
import { check, sleep } from "k6";

// --- TEMPLATE PLACEHOLDERS ---
const TEST_NAME = "__TEST_NAME__";
const METHOD = "__METHOD__";
const URL = "__URL__";
const QUERY_PARAMS = __QUERY_PARAMS__;
const BODY = __BODY__;
const THRESHOLDS_OBJECT = __THRESHOLDS__;
// --- END TEMPLATE PLACEHOLDERS ---

export const options = {
  scenarios: {
    [TEST_NAME]: {
      executor: "constant-arrival-rate",
      rate: 10,
      duration: "30s",
      preAllocatedVUs: 10,
      maxVUs: 50,
    },
  },
  thresholds: THRESHOLDS_OBJECT,
};

export default function () {
  const url = QUERY_PARAMS
    ? `${URL}?${new URLSearchParams(QUERY_PARAMS)}`
    : URL;
  const params = {
    headers: { "Content-Type": "application/json" },
  };
  const body = BODY ? JSON.stringify(BODY) : null;

  const res = http.request(METHOD.toLowerCase(), url, body, params);

  check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}
