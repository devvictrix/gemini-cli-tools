import * as http from "http";
import { AddressInfo } from "net";

const logPrefix = "[MockServer]";
const MOCK_PORT = 3333;

/**
 * A lightweight mock HTTP server to simulate the test API for local validation.
 */
export class MockServer {
  private server: http.Server | null = null;

  /**
   * Starts the mock server. The returned promise resolves ONLY after the server
   * is successfully listening for connections. It rejects if the server fails to start.
   * @returns A promise that resolves when the server is ready, or rejects on error.
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          this.handleRequest(req, res, body);
        });
      });

      // Handle server startup errors (like port already in use)
      this.server.on("error", (err) => {
        console.error(`${logPrefix} Failed to start mock server:`, err);
        reject(err);
      });

      // The 'listening' event callback is the correct place to resolve the promise.
      this.server.listen(MOCK_PORT, () => {
        const port = (this.server?.address() as AddressInfo).port;
        console.log(
          `${logPrefix} Mock server started and listening on http://localhost:${port}`
        );
        resolve();
      });
    });
  }

  /**
   * Stops the mock server.
   * @returns A promise that resolves when the server has successfully shut down.
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server && this.server.listening) {
        this.server.close((err) => {
          if (err) {
            console.error(`${logPrefix} Error stopping mock server:`, err);
            return reject(err);
          }
          console.log(`${logPrefix} Mock server stopped.`);
          this.server = null;
          resolve();
        });
      } else {
        // If server isn't running, resolve immediately.
        resolve();
      }
    });
  }

  /**
   * Handles incoming requests by routing them to the appropriate mock response.
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: string
  ): void {
    const { method, url, headers } = req;
    console.log(`${logPrefix} Received request: ${method} ${url}`);

    // Set common headers
    res.setHeader("Content-Type", "application/json");

    // --- Routing Logic ---
    if (method === "POST" && url === "/auth/token/login/") {
      try {
        const credentials = JSON.parse(body);
        if (
          credentials.username === "testuser" &&
          credentials.password === "password"
        ) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              access: "mock-auth-token-12345",
              refresh: "mock-refresh-token",
            })
          );
        } else {
          res.writeHead(401); // Use 401 for bad credentials
          res.end(JSON.stringify({ error: "Invalid credentials" }));
        }
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
      return;
    }

    if (method === "GET" && url === "/my/crocodiles/") {
      if (headers.authorization === "Bearer mock-auth-token-12345") {
        res.writeHead(200);
        res.end(
          JSON.stringify([{ id: 1, name: "Lyle (Protected)", sex: "M" }])
        );
      } else {
        res.writeHead(401);
        res.end(
          JSON.stringify({
            error: "Authentication credentials were not provided.",
          })
        );
      }
      return;
    }

    if (method === "GET" && url === "/public/crocodiles/") {
      res.writeHead(200);
      res.end(
        JSON.stringify([
          { id: 1, name: "Mock Bert", sex: "M" },
          { id: 2, name: "Mock Alice", sex: "F" },
        ])
      );
      return;
    }

    // --- Default Not Found ---
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found on mock server" }));
  }
}
