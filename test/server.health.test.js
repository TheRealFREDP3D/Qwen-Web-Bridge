"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const server_1 = require("../src/server");
// Mock VSCode ExtensionContext
const mockContext = {};
// Helper to get the Express app from the server class
function getApp() {
    const server = new server_1.QwenProxyServer(mockContext);
    // @ts-ignore: Accessing private property for testing
    return server.app;
}
describe("QwenProxyServer", () => {
    let app;
    beforeAll(() => {
        app = getApp();
    });
    it("GET /health should return status ok", async () => {
        const res = await (0, supertest_1.default)(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("status", "ok");
        expect(res.body).toHaveProperty("timestamp");
        expect(res.body).toHaveProperty("qwenConnected");
    });
});
//# sourceMappingURL=server.health.test.js.map