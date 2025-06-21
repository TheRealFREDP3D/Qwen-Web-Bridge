import express from "express";
import request from "supertest";
import { QwenProxyServer } from "../src/server";

// Mock VSCode ExtensionContext
const mockContext = {} as any;

// Helper to get the Express app from the server class
function getApp() {
  const server = new QwenProxyServer(mockContext);
  // @ts-ignore: Accessing private property for testing
  return server.app as express.Application;
}

describe("QwenProxyServer", () => {
  let app: express.Application;

  beforeAll(() => {
    app = getApp();
  });

  it("GET /health should return status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("qwenConnected");
  });
});
