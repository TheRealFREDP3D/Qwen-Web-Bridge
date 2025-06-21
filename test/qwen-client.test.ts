import { QwenClient } from "../src/qwen-client";
import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer';

// Mock VSCode ExtensionContext
const mockContext: vscode.ExtensionContext = {
    globalState: {
        get: jest.fn(),
        update: jest.fn()
    },
    globalStorageUri: { fsPath: '/mock/path' } as any,
    subscriptions: []
} as any;

describe("QwenClient", () => {
    let client: QwenClient;

    beforeEach(async () => {
        client = new QwenClient(mockContext);
        // Ensure the client is initialized before each test
        await client.initialize();
    });

    afterEach(async () => {
        await client.cleanup();
    });

    it("should initialize successfully and navigate to Qwen", async () => {
        await client.initialize();
        if (client.page) {
            const url = await client.page.url();
            expect(url).toContain("qwen.aliyun.com/chat");
        }
    });

    it("should launch browser", async () => {
        await client.initialize();
        if (client.page) {
            expect(client.page).toBeDefined();
        } else {
            expect(client.page).toBeDefined(); // Fail if page is not defined
        }
    });

    // Add more tests for browser interactions, etc.
});
