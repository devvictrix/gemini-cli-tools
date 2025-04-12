// app.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// --- Configuration ---
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`;
const API_KEY = process.env.GEMINI_API_KEY;
const CODE_FILE_PATH = path.join(__dirname, "consolidated_sources.ts"); // Path to the code file

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable not found.");
  console.log(
    "Please create a .env file in the project root and add your API key:"
  );
  console.log("GEMINI_API_KEY=YOUR_API_KEY_HERE");
  process.exit(1);
}

// --- Utility Function to Extract Code ---
function extractJavaScriptCode(text) {
  if (!text) return null;
  // Look for Markdown code blocks (```javascript ... ``` or just ``` ... ```)
  const markdownMatch = text.match(/```(?:javascript)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1].trim(); // Return the captured group
  }
  // If no markdown block, assume the whole response might be code (less reliable)
  // Basic check: does it look like JS? (very simplistic)
  if (
    text.includes("function") ||
    text.includes("const") ||
    text.includes("let") ||
    text.includes("console.log")
  ) {
    return text.trim();
  }
  return null; // Could not extract code
}

// --- API Call Function (modified to return the raw text response) ---
async function callGeminiApi(promptText) {
  console.log(`--- Sending Prompt to Gemini ---`);
  const preview = promptText.split("\n").slice(0, 8).join("\n"); // Show a bit more context
  console.log(preview + (promptText.split("\n").length > 8 ? "\n..." : ""));
  console.log("---------------------------------");

  const requestData = {
    contents: [{ parts: [{ text: promptText }] }],
    // Optional: Configure generation settings if needed (e.g., temperature)
    // generationConfig: { temperature: 0.7 }
  };

  const config = {
    headers: { "Content-Type": "application/json" },
    params: { key: API_KEY },
  };

  try {
    const response = await axios.post(GEMINI_API_ENDPOINT, requestData, config);

    if (
      response.data &&
      response.data.candidates &&
      response.data.candidates.length > 0 &&
      response.data.candidates[0].content &&
      response.data.candidates[0].content.parts &&
      response.data.candidates[0].content.parts.length > 0
    ) {
      const geminiResponseText =
        response.data.candidates[0].content.parts[0].text;
      console.log("\n--- Raw Gemini Response ---");
      console.log(geminiResponseText.trim());
      console.log("---------------------------\n");
      return geminiResponseText; // Return the full response text
    } else {
      console.warn(
        "Warning: Received an unexpected response structure from Gemini."
      );
      console.log(
        "Full Response Data:",
        JSON.stringify(response.data, null, 2)
      );
      return null;
    }
  } catch (error) {
    console.error("\n--- Error calling Gemini API ---");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error("Request Error: No response received.", error.request);
    } else {
      console.error("Error Message:", error.message);
    }
    console.error("-----------------------------\n");
    return null; // Indicate failure
  }
}

// --- Main Execution Logic ---
async function main() {
  let originalCode;
  try {
    originalCode = fs.readFileSync(CODE_FILE_PATH, "utf8");
    console.log(`Successfully read original code from ${CODE_FILE_PATH}`);
  } catch (readError) {
    console.error(`Error reading file ${CODE_FILE_PATH}:`, readError.message);
    process.exit(1);
  }

  // --- Define the Prompt for Gemini ---
  // Ask it to modify the code and return ONLY the code. Be specific!
  const prompt = `
Review the following JavaScript code. If you find areas for improvement (e.g., clarity, efficiency, comments), modify it.
**IMPORTANT: Respond with ONLY the complete, updated JavaScript code block itself, without any explanation before or after the code block.**

\`\`\`javascript
${originalCode}
\`\`\`
`;

  const geminiResponse = await callGeminiApi(prompt);

  if (geminiResponse) {
    console.log("Attempting to extract code from response...");
    const extractedCode = extractJavaScriptCode(geminiResponse);

    if (extractedCode) {
      console.log("Successfully extracted code.");
      // Compare original code with the extracted code (trim whitespace for better comparison)
      if (originalCode.trim() !== extractedCode.trim()) {
        console.log("\n✨ New version detected from Gemini!");
        console.log("--- Proposed Code ---");
        console.log(extractedCode);
        console.log("---------------------\n");

        // *** DANGER ZONE: Overwriting the file ***
        console.warn(`WARNING: Automatically overwriting ${CODE_FILE_PATH}...`);
        try {
          fs.writeFileSync(CODE_FILE_PATH, extractedCode, "utf8");
          console.log(`✅ Successfully updated ${CODE_FILE_PATH}.`);

          // Optional: Stage the changes in Git automatically (Use with caution!)
          // const { execSync } = require('child_process');
          // try {
          //   execSync(`git add ${CODE_FILE_PATH}`);
          //   console.log(`✅ Staged changes for ${CODE_FILE_PATH} in Git.`);
          // } catch (gitError) {
          //   console.error(`Failed to stage changes in Git: ${gitError.message}`);
          // }
        } catch (writeError) {
          console.error(
            `❌ Error writing file ${CODE_FILE_PATH}:`,
            writeError.message
          );
        }
        // *** END DANGER ZONE ***
      } else {
        console.log(
          "\n✅ Gemini response code matches original code. No changes needed."
        );
      }
    } else {
      console.warn(
        "\n⚠️ Could not extract a valid JavaScript code block from the Gemini response. No changes made."
      );
    }
  } else {
    console.log(
      "\nDid not receive a valid response from Gemini. No changes made."
    );
  }
}

// Execute the main function
main();
