Of course. As your development partner, maintaining clear and up-to-date documentation is a critical step in the **Deliver** stage of our lifecycle.

Given the significant new capabilities we've added with the `k6-runner`, the `README.md` needs a major update. It should introduce the project, explain the new performance testing features in detail, and guide a new user on how to get started.

Here is the updated, comprehensive `README.md` file.

---

```markdown
# Gemini CLI Tools

A suite of command-line tools designed to accelerate software development, combining AI-powered code assistance with a robust, data-driven performance testing engine.

## Overview

This project provides a powerful command-line interface (CLI) to automate and enhance common development tasks. It leverages the Google Gemini API for intelligent code analysis and generation, and integrates the Grafana k6 engine for sophisticated, data-driven performance testing.

The core philosophy of this project is guided by **The Universal Engineering Playbook (`GEMINI.md`)**, which defines a set of timeless software craftsmanship principles that govern all contributions, both human and AI.

## Features

### AI-Powered Code Enhancements
- **Analyze:** Get a high-level analysis of code quality, structure, and potential improvements.
- **Add Comments:** Automatically add comprehensive TSDoc/JSDoc and inline comments to your code.
- **Explain:** Receive a plain-language explanation of what a piece of code does.
- **Generate Tests:** Create unit tests for your source files with a hint for your preferred framework (e.g., Jest, Vitest).
- **Documentation:** Generate project README files, module-specific documentation, and architectural analyses.

### Data-Driven Performance Testing (`run-k6`)
- **Decoupled Data:** Define all your test cases—including endpoints, headers, bodies, and load profiles—in a simple CSV or XLSX file.
- **Dynamic Executors:** Configure a wide range of k6 load test executors (`ramping-vus`, `constant-vus`, `per-vu-iterations`, etc.) directly from your data file on a per-test basis.
- **Custom Headers:** Easily add Authorization tokens, API keys, or any other custom headers to your requests.
- **Zod Validation:** All test data is strictly validated at runtime, providing clear, actionable error messages for malformed data.
- **JSON Output:** Automatically export detailed performance metrics for each test run to a JSON file, perfect for CI/CD integration and historical analysis.

## Getting Started

### Prerequisites
1.  **Node.js:** (v18+ recommended)
2.  **npm** (or yarn/pnpm)
3.  **Grafana k6:** The k6 binary must be installed on your system and available in your PATH.
    -   Follow the official installation guide: [k6 Installation](https://k6.io/docs/getting-started/installation/)

### Installation
1.  Clone the repository:
    ```bash
    git clone <your-repository-url>
    cd gemini-cli-tools
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Configure your environment:
    -   Copy the `.env.example` file to `.env`.
    -   Add your Google Gemini API key to the `.env` file:
        ```env
        GEMINI_API_KEY=your_api_key_here
        ```

## Usage

The primary way to use the tool is via the `dev` script in `package.json`.

**General Syntax:**
```bash
npm run dev -- <command> [targetPath] [options]
```
*Note: The `--` is important to separate npm arguments from your script's arguments.*

### AI Commands
- `npm run dev -- Analyze src/`
- `npm run dev -- AddComments src/my-file.ts`
- `npm run dev -- GenerateTests src/my-service.ts -f vitest`

---

### Data-Driven k6 Runner (`run-k6`)

This is the most powerful feature for performance testing. It executes a series of tests defined in a data file.

**Command:**
```bash
npm run dev -- run-k6 <path/to/data.csv> -o <output/directory/>
```
- `<path/to/data.csv>`: The path to your XLSX or CSV test data file.
- `-o <output/directory/>`: (Optional) A directory where JSON summary reports will be saved.

#### CSV Data Source Format

Your CSV file is the control panel for all your tests. It must contain a header row with the following columns (all are optional except `method` and `url`/`path`).

| Column            | Description                                                                                             | Example                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `testName`        | A human-readable name for the test.                                                                     | `"Create a New Product"`                                                                   |
| `method`          | The HTTP method (GET, POST, PUT, DELETE). **Required.**                                                 | `POST`                                                                                     |
| `url`             | The full URL for the request. **Required.**                                                             | `"https://dummyjson.com/products/add"`                                                     |
| `queryParams`     | A JSON string of query parameters to append to the URL.                                                 | `"{""limit"":10}"`                                                                         |
| `body`            | A JSON string for the request body (for POST/PUT).                                                      | `"{""title"":""Perfume Oil""}"`                                                             |
| `headers`         | A JSON string of custom HTTP headers to include.                                                        | `"{""Authorization"":""Bearer YOUR_TOKEN""}"`                                              |
| `thresholds`      | A JSON object defining k6 performance thresholds.                                                       | `"{""http_req_duration"":[""p(95)<500""],""http_req_failed"":[""rate<0.01""]}"`              |
| `executorOptions` | A JSON object defining the k6 executor. If omitted, a default `constant-arrival-rate` executor is used. | `"{""executor"":""ramping-vus"",""stages"":[{""duration"":""10s"",""target"":20}]}"`          |

#### Example `k6-test-data.csv`

```csv
testName,method,url,queryParams,body,thresholds,headers,executorOptions
"Get Products (Ramping VUs)",GET,"https://dummyjson.com/products","{""limit"":10}","",,"{""http_req_duration"":[""p(95)<500""]}","","{""executor"":""ramping-vus"",""startVUs"":1,""stages"":[{""duration"":""10s"",""target"":20},{""duration"":""20s"",""target"":20}]}"
"Get User with Auth Token",GET,"https://api.test.k6.io/my/crocodiles/",,,"{""http_reqs"":[""count>5""]}","{""Authorization"":""Bearer YOUR_TOKEN_HERE""}","{""executor"":""per-vu-iterations"",""vus"":5,""iterations"":20}"
"Create Product (Constant VUs)",POST,"https://dummyjson.com/products/add",,"{""title"":""New k6 Product""}","{""http_req_duration"":[""p(95)<800""]}","","{""executor"":""constant-vus"",""vus"":10,""duration"":""30s""}"
```

## Development

-   **Build:** Compile TypeScript to JavaScript in the `dist/` directory and copy assets.
    ```bash
    npm run build
    ```
-   **Run in Development:** Execute the CLI using `tsx` for on-the-fly compilation.
    ```bash
    npm run dev
    ```
-   **Run in Production:** Execute the compiled code from the `dist/` directory.
    ```bash
    npm start
    ```
-   **Test:** Run unit tests using Jest.
    ```bash
    npm test
    ```

## The Engineering Playbook (`GEMINI.md`)

This project is developed in partnership with an AI. The `GEMINI.md` file serves as a manifesto and constitution that guides the AI's behavior, ensuring all contributions adhere to sound software engineering principles like SOLID, Clean Architecture, and Modularity.

## License

This project is UNLICENSED.