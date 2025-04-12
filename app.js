// app.js
const axios = require("axios");
const fs = require("fs"); // Import Node.js File System module
const path = require("path"); // Import Node.js Path module
require("dotenv").config();

// --- Configuration ---
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`;
const API_KEY = process.env.GEMINI_API_KEY;
const CODE_FILE_PATH = path.join(__dirname, "sample_code.js"); // Path to the code file

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable not found.");
  console.log(
    "Please create a .env file in the project root and add your API key:"
  );
  console.log("GEMINI_API_KEY=YOUR_API_KEY_HERE");
  process.exit(1);
}

// --- API Call Function (remains the same) ---
async function callGeminiApi(promptText) {
  console.log(
    `--- Sending Prompt to Gemini (from ${path.basename(CODE_FILE_PATH)}) ---`
  );
  // Log the first few lines of the prompt for brevity if it's long
  const preview = promptText.split("\n").slice(0, 5).join("\n");
  console.log(preview + (promptText.split("\n").length > 5 ? "\n..." : ""));
  console.log("----------------------------------------------------");

  const requestData = {
    contents: [
      {
        parts: [
          {
            text: promptText, // The prompt is now the content of the file
          },
        ],
      },
    ],
    // Add generationConfig or safetySettings here if needed
  };

  const config = {
    headers: {
      "Content-Type": "application/json",
    },
    params: {
      key: API_KEY,
    },
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
      console.log("\n--- Gemini Response ---");
      console.log(geminiResponseText.trim());
      console.log("-----------------------\n");
      return geminiResponseText;
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
    return null;
  }
}

// --- Main Execution ---
async function main() {
  let codePrompt;
  try {
    // Read the content of the code file synchronously
    // 'utf8' encoding ensures we get a string, not a buffer
    codePrompt = fs.readFileSync(CODE_FILE_PATH, "utf8");
    console.log(`Successfully read code from ${CODE_FILE_PATH}`);
  } catch (readError) {
    console.error(`Error reading file ${CODE_FILE_PATH}:`, readError.message);
    process.exit(1); // Exit if we can't read the file
  }

  // Now, send the content of the file as the prompt
  // You might want to add context like "Explain this code:\n\n" + codePrompt
  await callGeminiApi(codePrompt);

  // Example of adding context:
  // const promptWithContext = `Explain the following JavaScript code:\n\n\`\`\`javascript\n${codePrompt}\n\`\`\``;
  // await callGeminiApi(promptWithContext);
}

// Execute the main function
main();
