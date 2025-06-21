import express from "express";
import request from "supertest";
import { QwenProxyServer } from "../src/server";

const mockContext = {} as any;
function getApp() {
  const server = new QwenProxyServer(mockContext);
  // @ts-ignore
  return server.app as express.Application;
}

describe("/v1/chat/completions endpoint", () => {
  let app: express.Application;
  beforeAll(() => {
    app = getApp();
  });
  it("POST /v1/chat/completions with invalid body should return 400", async () => {
    const res = await request(app).post("/v1/chat/completions").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("message");
  });
  it("POST /v1/chat/completions with valid body should return 200 and a response", async () => {
    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ messages: [{ role: "user", content: "Hello" }] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("choices");
  });
});
