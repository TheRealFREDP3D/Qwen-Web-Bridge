import express from "express";
import request from "supertest";
import { QwenProxyServer } from "../src/server";

const mockContext = {} as any;
function getApp() {
  const server = new QwenProxyServer(mockContext);
  // @ts-ignore
  return server.app as express.Application;
}

describe("/status endpoint", () => {
  let app: express.Application;
  beforeAll(() => {
    app = getApp();
  });
  it("GET /status should return server status", async () => {
    const res = await request(app).get("/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("server", "running");
    expect(res.body).toHaveProperty("qwenClient");
    expect(res.body).toHaveProperty("port");
    expect(res.body).toHaveProperty("uptime");
  });
});
