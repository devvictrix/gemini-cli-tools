#### 2. Upgraded `src/k6-runner/templates/default.k6.js`
This new template is completely different. It's designed to be a "container" for multiple test functions that will be injected by our service.

```javascript:src/k6-runner/templates/default.k6.js
// File: src/k6-runner/templates/default.k6.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';

// --- PLACEHOLDERS ---
const SCENARIOS_OBJECT = __SCENARIOS_OBJECT__;
const THRESHOLDS_OBJECT = __THRESHOLDS_OBJECT__;
// --- END PLACEHOLDERS ---

// Store extracted variables globally for chaining requests across groups
let extractedVars = {};

export const options = {
  scenarios: SCENARIOS_OBJECT,
  thresholds: THRESHOLDS_OBJECT,
};

// Helper to get a value from a JSON object using a path like "id" or "user.name"
function getJsonValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((o, k) => (o || {})[k], obj);
}

// Helper for placeholder replacement
function replacePlaceholders(str, vars) {
    if (typeof str !== 'string') return str;
    // Replace dynamic data generators
    str = str.replace(/\{\{\$randomInt\((\d+),(\d+)\)\}\}/g, (_, min, max) => 
        Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) + parseInt(min)
    );
    // Replace extracted variables
    str = str.replace(/\{\{(\w+)\}\}/g, (_, varName) => vars[varName] || '');
    return str;
}


// --- INJECTED TEST FUNCTIONS WILL GO HERE ---
// Example:
// export function CreateaNewProduct() { ... }
// export function GettheNewProduct() { ... }
__INJECTED_TEST_FUNCTIONS__
```

#### 3. Rewritten `src/k6-runner/services/k6-runner.service.ts`
This is the new "brain" of the operation. It now builds a **single script** with all the test cases defined as separate, exported functions and a scenarios object that orchestrates them. This enables true request chaining.

```typescript:src/k6-runner/services/k6-runner.service.ts

```

This is a major architectural overhaul that makes the tool immensely more powerful and aligns with professional testing practices. With these changes, your tool will now correctly perform request chaining and handle complex executor configurations.