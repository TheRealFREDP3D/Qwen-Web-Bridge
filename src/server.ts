import cors from "cors";
import express from "express";
import * as http from "http";
import * as vscode from "vscode";
import { QwenClient } from "./qwen-client";
import { OpenAIRequest, OpenAIResponse, OpenAIStreamResponse } from "./types";

export class QwenProxyServer {
  private app: express.Application;
  private server: http.Server | undefined;
  private qwenClient: QwenClient;
  private port: number;
  private isServerRunning = false;

  constructor(
    private context: vscode.ExtensionContext,
    qwenClient?: QwenClient
  ) {
    this.app = express();
    this.qwenClient = qwenClient || new QwenClient(this.context);

    // Get configuration
    const config = vscode.workspace.getConfiguration("qwen-proxy");
    this.port = config.get("port", 3001);

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        qwenConnected: this.qwenClient.isConnected(),
      });
    });

    // OpenAI-compatible chat completions endpoint
    this.app.post("/v1/chat/completions", async (req, res) => {
      try {
        const openAIRequest: OpenAIRequest = req.body;

        // Validate request
        if (!openAIRequest.messages || !Array.isArray(openAIRequest.messages)) {
          return res.status(400).json({
            error: { message: "Invalid request: messages array required" },
          });
        }

        // Handle streaming vs non-streaming
        if (openAIRequest.stream) {
          await this.handleStreamingRequest(openAIRequest, res);
        } else {
          await this.handleNonStreamingRequest(openAIRequest, res);
        }
      } catch (error) {
        console.error("Error processing chat completion:", error);
        res.status(500).json({
          error: {
            message: "Internal server error",
            details: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    });

    // Models endpoint (OpenAI compatibility)
    this.app.get("/v1/models", (req, res) => {
      res.json({
        object: "list",
        data: [
          {
            id: "qwen-turbo",
            object: "model",
            created: Date.now(),
            owned_by: "qwen-proxy",
          },
          {
            id: "qwen-plus",
            object: "model",
            created: Date.now(),
            owned_by: "qwen-proxy",
          },
        ],
      });
    });

    // Proxy status endpoint
    this.app.get("/status", (req, res) => {
      res.json({
        server: "running",
        qwenClient: this.qwenClient.isConnected()
          ? "connected"
          : "disconnected",
        port: this.port,
        uptime: process.uptime(),
      });
    });
  }

  private async handleNonStreamingRequest(
    request: OpenAIRequest,
    res: express.Response
  ) {
    const response = await this.qwenClient.sendMessage(request);

    const openAIResponse: OpenAIResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: request.model || "qwen-turbo",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: response,
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: this.estimateTokens(request.messages),
        completion_tokens: this.estimateTokens([
          { role: "assistant", content: response },
        ]),
        total_tokens: 0,
      },
    };

    openAIResponse.usage.total_tokens =
      openAIResponse.usage.prompt_tokens +
      openAIResponse.usage.completion_tokens;

    res.json(openAIResponse);
  }

  private async handleStreamingRequest(
    request: OpenAIRequest,
    res: express.Response
  ) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const streamId = `chatcmpl-${Date.now()}`;

    try {
      await this.qwenClient.sendMessageStream(request, (chunk: string) => {
        const streamResponse: OpenAIStreamResponse = {
          id: streamId,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: request.model || "qwen-turbo",
          choices: [
            {
              index: 0,
              delta: {
                content: chunk,
              },
              finish_reason: null,
            },
          ],
        };

        res.write(`data: ${JSON.stringify(streamResponse)}\n\n`);
      });

      // Send final chunk
      const finalResponse: OpenAIStreamResponse = {
        id: streamId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: request.model || "qwen-turbo",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
      };

      res.write(`data: ${JSON.stringify(finalResponse)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("Streaming error:", error);
      res.write(`data: {"error": "${error}"}\n\n`);
      res.end();
    }
  }

  private estimateTokens(
    messages: Array<{ role: string; content: string }>
  ): number {
    const text = messages.map((m) => m.content).join(" ");
    return Math.ceil(text.length / 4); // Rough estimate: 4 chars per token
  }

  async start(): Promise<void> {
    if (this.isServerRunning) {
      throw new Error("Server is already running");
    }

    return new Promise(async (resolve, reject) => {
      // Ensure client is initialized before starting server
      try {
        await this.qwenClient.initialize();
      } catch (error) {
        console.error("Failed to initialize Qwen client:", error);
        reject(error);
        return;
      }

      this.server = this.app.listen(this.port, () => {
        this.isServerRunning = true;
        console.log(`Qwen Proxy server started on port ${this.port}`);
        resolve();
      });

      this.server.on("error", (error) => {
        this.isServerRunning = false;
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server || !this.isServerRunning) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isServerRunning = false;
        console.log("Qwen Proxy server stopped");
        resolve();
      });

      // Clean up Qwen client
      this.qwenClient.cleanup();
    });
  }

  isRunning(): boolean {
    return this.isServerRunning;
  }

  getPort(): number {
    return this.port;
  }

  async clearCookies(): Promise<void> {
    await this.qwenClient.clearCookies();
  }

  async openBrowser(): Promise<void> {
    await this.qwenClient.openBrowser();
  }
}
