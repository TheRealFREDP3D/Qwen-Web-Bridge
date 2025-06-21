import * as puppeteer from "puppeteer";
import { Browser, ElementHandle, Page } from "puppeteer";
import * as vscode from "vscode";
import { OpenAIRequest } from "./types";

const SELECTORS = {
  login: 'button[class*="login"], a[href*="login"], .login-button',
  chatInput: [
    'textarea[placeholder*="ask"], textarea[placeholder*="question"]',
    'input[placeholder*="ask"], input[placeholder*="question"]',
    ".chat-input textarea",
    ".input-box textarea",
    '[data-testid="chat-input"]',
  ],
  submit: [
    'button[type="submit"]',
    'button:has-text("Send")',
    'button:has-text("发送")',
    ".send-button",
    '[data-testid="send-button"]',
    'button[class*="send"]',
  ],
  response: '.message-content, .response-text, [data-testid="message-content"]',
  complete: ".response-complete, .generation-done",
  history: [
    ".message-content",
    ".response-text",
    '[data-testid="message-content"]',
  ],
};

export class QwenClient {
  private browser: Browser | undefined;
  private page: Page | undefined;
  private isInitialized = false;
  private config: vscode.WorkspaceConfiguration;
  private extensionContext: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.config = vscode.workspace.getConfiguration("qwen-proxy");
    this.extensionContext = context;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("Qwen client is already initialized.");
      return;
    }

    try {
      const headless = this.config.get("headless", true)
        ? ("new" as const)
        : (false as const);
      const executablePath = this.config.get<string>("browserExecutablePath");

      this.browser = await puppeteer.launch({
        headless,
        executablePath: executablePath || undefined,
      });

      this.page =
        (await this.browser.pages())[0] || (await this.browser.newPage());

      await this.loadCookies();

      await this.page.goto("https://qwen.aliyun.com/chat", {
        waitUntil: "domcontentloaded",
      });

      this.isInitialized = true;
      console.log("Qwen client initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize Qwen client:", error);
      this.isInitialized = false;
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    try {
      if (this.isInitialized) {
        await this.saveCookies();
      }
      if (this.browser) {
        await this.browser.close();
      }
    } finally {
      this.browser = undefined;
      this.page = undefined;
      this.isInitialized = false;
      console.log("Qwen client cleaned up");
    }
  }

  public async openBrowser(): Promise<void> {
    await this.cleanup();
    await this.config.update(
      "headless",
      false,
      vscode.ConfigurationTarget.Global
    );
    await this.initialize();
    await this.page?.bringToFront();
    vscode.window.showInformationMessage(
      "Browser opened for manual login. Please log in to Qwen and then close the browser."
    );
  }

  public isConnected(): boolean {
    return this.isInitialized && !!this.browser && !!this.page;
  }

  public async sendMessage(request: OpenAIRequest): Promise<string> {
    if (!this.isInitialized || !this.page) {
      throw new Error(
        "Browser not initialized. Please open the browser first."
      );
    }

    const prompt = this.convertMessagesToPrompt(request.messages);
    const filled = await this.fillChatInput(prompt);
    if (!filled) {
      throw new Error("Failed to find chat input field.");
    }

    await this.submitMessage();

    return await this.waitForResponse();

  }

  public async sendMessageStream(
    request: OpenAIRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    if (!this.isInitialized || !this.page) {
      throw new Error(
        "Browser not initialized. Please open the browser first."
      );
    }

    const prompt = this.convertMessagesToPrompt(request.messages);
    const filled = await this.fillChatInput(prompt);
    if (!filled) {
      throw new Error("Failed to find chat input field.");
    }

    await this.submitMessage();
    await this.waitForStreamingResponse(onChunk);
  }

  private convertMessagesToPrompt(
    messages: Array<{ role: string; content: string }>
  ): string {
    return messages.map((m) => `${m.role}: ${m.content}`).join("\\n");
  }

  public async getHistory(count: number): Promise<string[]> {
    if (!this.isInitialized || !this.page) {
      throw new Error(
        "Browser not initialized. Please open the browser first."
      );
    }

    const history: string[] = [];
    const responseElements = await this.page.$$(SELECTORS.response);

    for (const element of responseElements.slice(-count)) {
      const text = await this.page.evaluate((el) => el.textContent, element);
      if (text) {
        history.push(text.trim());
      }
    }

    return history;
  }

  public async clearCookies(): Promise<void> {
    if (this.page) {
      const client = await this.page.target().createCDPSession();
      await client.send("Network.clearBrowserCookies");

      const storagePath =
        this.extensionContext.globalState.get<string>("qwenCookiePath");
      if (storagePath) {
        try {
          await vscode.workspace.fs.delete(vscode.Uri.file(storagePath));
          await this.extensionContext.globalState.update(
            "qwenCookiePath",
            undefined
          );
        } catch (e) {
          console.error("Failed to delete cookie file", e);
        }
      }
      console.log("Cookies cleared.");
    }
  }

  private async saveCookies(): Promise<void> {
    if (this.page) {
      const cookies = await this.page.cookies();
      const storagePath = vscode.Uri.joinPath(
        this.extensionContext.globalStorageUri,
        "qwen-cookies.json"
      ).fsPath;
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(storagePath),
        Buffer.from(JSON.stringify(cookies))
      );
      await this.extensionContext.globalState.update(
        "qwenCookiePath",
        storagePath
      );
    }
  }

  private async loadCookies(): Promise<void> {
    if (!this.page) return;
    const storagePath =
      this.extensionContext.globalState.get<string>("qwenCookiePath");
    if (storagePath) {
      try {
        const cookiesBuffer = await vscode.workspace.fs.readFile(
          vscode.Uri.file(storagePath)
        );
        const cookies = JSON.parse(cookiesBuffer.toString());
        if (cookies && cookies.length) {
          await this.page.setCookie(...cookies);
        }
      } catch (error) {
        console.error("Failed to load cookies:", error);
      }
    }
  }

  private async find(selectorList: string[]): Promise<ElementHandle | null> {
    if (!this.page) return null;
    for (const s of selectorList) {
      const h = await this.page.$(s);
      if (h) return h;
    }
    return null;
  }

  private async fillChatInput(prompt: string): Promise<boolean> {
    const input = await this.find(SELECTORS.chatInput);
    if (!input) return false;
    await input.type(prompt);
    return true;
  }

  private async submitMessage(): Promise<void> {
    if (!this.page) return;
    const btn = await this.find(SELECTORS.submit);
    if (btn) {
      await btn.click();
    } else {
      await this.page.keyboard.press("Enter");
    }
  }

  private async waitForResponse(timeout = 30000): Promise<string> {
    if (!this.page) return "";
    return this.pollResponse(timeout);
  }

  private async pollResponse(timeout = 30000): Promise<string> {
    if (!this.page) return "";
    const start = Date.now();
    let last = "";
    while (Date.now() - start < timeout) {
      try {
        await this.page.waitForSelector(SELECTORS.response, { timeout: 1000 });
      } catch (e) {
        // Continue polling
      }
      const cur = await this.page.evaluate((sel) => {
        const all = document.querySelectorAll(sel);
        return all.length > 0
          ? all[all.length - 1]?.textContent?.trim() || ""
          : "";
      }, SELECTORS.response);

      if (cur !== last) {
        last = cur;
      }

      const isComplete = await this.page.evaluate((sel) => {
        return !!document.querySelector(sel);
      }, SELECTORS.complete);

      if (isComplete) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return last.trim();
  }

  private async waitForStreamingResponse(
    onChunk: (chunk: string) => void
  ): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    let lastContent = "";
    const maxWaitTime = 60000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const contentElement = await this.page.$(SELECTORS.response);
      if (contentElement) {
        const currentContent =
          (await this.page.evaluate((el) => el.textContent, contentElement)) ||
          "";
        if (currentContent.trim() !== lastContent.trim()) {
          const newChunk = currentContent.substring(lastContent.length);
          if (newChunk) {
            onChunk(newChunk);
            lastContent = currentContent;
          }
        }
      }

      const isComplete = await this.page.evaluate((sel) => {
        return !!document.querySelector(sel);
      }, SELECTORS.complete);

      if (isComplete) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}
