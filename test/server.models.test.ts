import express from "express";
import request from "supertest";
import { QwenProxyServer } from "../src/server";

const mockContext = {} as any;
function getApp() {
  const server = new QwenProxyServer(mockContext);
  // @ts-ignore
  return server.app as express.Application;
}

describe("/v1/models endpoint", () => {
  let app: express.Application;
  beforeAll(() => {
    app = getApp();
  });
  it("GET /v1/models should return a list of models", async () => {
    const res = await request(app).get("/v1/models");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("object", "list");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((m: any) => m.id === "qwen-turbo")).toBe(true);
    expect(res.body.data.some((m: any) => m.id === "qwen-plus")).toBe(true);
  });
});
