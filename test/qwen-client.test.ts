import * as vscode from "vscode";
import { QwenClient } from "../src/qwen-client";
import * as puppeteer from "puppeteer";

// Mock VSCode ExtensionContext
const mockContext: vscode.ExtensionContext = {
  globalState: {
    get: jest.fn(),
    update: jest.fn(),
  },
  globalStorageUri: { fsPath: "/mock/path" } as any,
  subscriptions: [],
} as any;

// Mock the puppeteer page and browser
const mockPage = {
  goto: jest.fn(() => Promise.resolve()),
  setCookie: jest.fn((...cookies: any[]) => Promise.resolve()),
  cookies: jest.fn((): Promise<any[]> => Promise.resolve([])),
  evaluate: jest.fn<any, any>(() => Promise.resolve("")),
  waitForSelector: jest.fn(() => Promise.resolve()),
  $: jest.fn(() => Promise.resolve(null)),
  $$: jest.fn(() => Promise.resolve([])),
  type: jest.fn(() => Promise.resolve()),
  click: jest.fn(() => Promise.resolve()),
  keyboard: {
    press: jest.fn(() => Promise.resolve()),
  },
  target: jest.fn(() => ({
    createCDPSession: jest.fn(() => ({
      send: jest.fn(() => Promise.resolve()),
    })),
  })),
  screenshot: jest.fn(() => Promise.resolve()),
  bringToFront: jest.fn(() => Promise.resolve()),
  url: jest.fn(() => "https://qwen.aliyun.com/chat"), // Mock url for testing
};

const mockBrowser = {
  pages: jest.fn(() => Promise.resolve([mockPage])),
  newPage: jest.fn(() => Promise.resolve(mockPage)),
  close: jest.fn(() => Promise.resolve()),
};

// Mock puppeteer.launch
jest.mock("puppeteer", () => ({
  launch: jest.fn(() => Promise.resolve(mockBrowser)),
}));

describe("QwenClient", () => {
  let client: QwenClient;
  let createOutputChannelSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Explicitly mock vscode.window.createOutputChannel
    createOutputChannelSpy = jest.spyOn(vscode.window, 'createOutputChannel').mockReturnValue({
      appendLine: jest.fn(),
      name: 'MockOutputChannel',
      dispose: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      append: jest.fn(),
      replace: jest.fn(), // Added missing 'replace' method
      // Add missing properties for LogOutputChannel
      logLevel: vscode.LogLevel.Info,
      onDidChangeLogLevel: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });

    client = new QwenClient(mockContext);

    // Mock internal methods that interact with Puppeteer during initialization
    (client as any).page = mockPage; // Directly assign the mock page
    (client as any).browser = mockBrowser; // Directly assign the mock browser
    (client as any).loadCookies = jest.fn(() => Promise.resolve());
    (client as any).saveCookies = jest.fn(() => Promise.resolve());
    (client as any).takeScreenshot = jest.fn(() => Promise.resolve());
  });

  afterEach(async () => {
    // Restore the original implementation after each test
    createOutputChannelSpy.mockRestore();
  });

  it("should initialize successfully and navigate to Qwen", async () => {
    await client.initialize();
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    expect(mockPage.goto).toHaveBeenCalledWith("https://qwen.aliyun.com/chat", expect.any(Object));
    expect((client as any).isInitialized).toBe(true);
  });

  it("should launch browser", async () => {
    await client.initialize();
    expect((client as any)["page"]).toBeDefined();
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
  });

  it("should handle browser launch failure gracefully", async () => {
    (puppeteer.launch as jest.Mock).mockRejectedValueOnce(new Error("Launch failed"));
    await expect(client.initialize()).rejects.toThrow("Launch failed");
    expect((client as any).isInitialized).toBe(false);
  });

  it("should handle navigation failure gracefully", async () => {
    mockPage.goto.mockRejectedValueOnce(new Error("Navigation failed"));
    await expect(client.initialize()).rejects.toThrow("Navigation failed");
    expect((client as any).isInitialized).toBe(false);
  });

  it("should send message and return response", async () => {
    // Mock the necessary methods for sendMessage
    (client as any).isInitialized = true; // Manually set to true for this test
    (client as any).fillChatInput = jest.fn(() => Promise.resolve(true));
    (client as any).submitMessage = jest.fn(() => Promise.resolve());
    (client as any).waitForResponse = jest.fn(() => Promise.resolve("Mocked response"));

    const request = { model: "test-model", messages: [{ role: "user" as const, content: "Test message" }] };
    const response = await client.sendMessage(request);
    expect(response).toBe("Mocked response");
    expect((client as any).fillChatInput).toHaveBeenCalledWith("user: Test message");
    expect((client as any).submitMessage).toHaveBeenCalled();
    expect((client as any).waitForResponse).toHaveBeenCalled();
  });

  it("should send streaming message", async () => {
    // Mock the necessary methods for sendMessageStream
    (client as any).isInitialized = true; // Manually set to true for this test
    (client as any).fillChatInput = jest.fn(() => Promise.resolve(true));
    (client as any).submitMessage = jest.fn(() => Promise.resolve());
    (client as any).waitForStreamingResponse = jest.fn((onChunk) => {
      onChunk("Mocked chunk 1");
      onChunk("Mocked chunk 2");
      return Promise.resolve();
    });

    const request = { model: "test-model", messages: [{ role: "user" as const, content: "Streaming test" }] };
    const chunks: string[] = [];
    await client.sendMessageStream(request, (chunk) => chunks.push(chunk));

    expect((client as any).fillChatInput).toHaveBeenCalledWith("user: Streaming test");
    expect((client as any).submitMessage).toHaveBeenCalled();
    expect((client as any).waitForStreamingResponse).toHaveBeenCalled();
    expect(chunks).toEqual(["Mocked chunk 1", "Mocked chunk 2"]);
  });

  it("should get history", async () => {
    (client as any).isInitialized = true;
    mockPage.$$ = jest.fn(() => Promise.resolve([
      { textContent: "History item 1" },
      { textContent: "History item 2" },
    ] as any));
    mockPage.evaluate = jest.fn<any, any>((fn: Function, el: any) => Promise.resolve(el.textContent));

    const history = await client.getHistory(2);
    expect(history).toEqual(["History item 1", "History item 2"]);
    expect(mockPage.$$).toHaveBeenCalledWith(expect.any(String));
  });

  it("should clear cookies", async () => {
    (client as any).isInitialized = true;
    (mockContext.globalState.get as jest.Mock).mockReturnValueOnce("/mock/path/qwen-cookies.json");

    await client.clearCookies();
    expect(mockPage.target).toHaveBeenCalled();
    expect(mockContext.globalState.update).toHaveBeenCalledWith("qwenCookiePath", undefined);
    expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(vscode.Uri.file("/mock/path/qwen-cookies.json"));
  });

  it("should save cookies when cleanup is called and client is initialized", async () => {
    (client as any).isInitialized = true;
    mockPage.cookies.mockResolvedValueOnce([{ name: "test", value: "123", domain: "example.com", path: "/", expires: 123, httpOnly: false, secure: false, session: false } as any]);
    mockPage.cookies.mockResolvedValueOnce([{ name: "test", value: "123", domain: "example.com", path: "/", expires: 123, httpOnly: false, secure: false, session: false } as any]);
    (client as any).saveCookies = jest.fn(() => Promise.resolve()); // Mock the private method

    await client.cleanup();
    expect((client as any).saveCookies).toHaveBeenCalled();
  });

  it("should load cookies during initialization if path exists", async () => {
    // Remove loadCookies mock for this specific test
    (client as any).loadCookies = undefined;

    (mockContext.globalState.get as jest.Mock).mockReturnValueOnce("/mock/path/qwen-cookies.json");
    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValueOnce(Buffer.from(JSON.stringify([{ name: "test", value: "123", domain: "example.com", path: "/", expires: 123, httpOnly: false, secure: false, session: false } as any])));

    await client.initialize();
    expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(vscode.Uri.file("/mock/path/qwen-cookies.json"));
    expect(mockPage.setCookie).toHaveBeenCalledWith({ name: "test", value: "123", domain: "example.com", path: "/", expires: 123, httpOnly: false, secure: false, session: false } as any);
  });
});
