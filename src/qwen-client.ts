import { Browser, BrowserContext, ElementHandle, Page } from "playwright-core";
import * as vscode from "vscode";

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
  private context: BrowserContext | undefined;
  private page: Page | undefined;
  private isInitialized = false;
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration("qwen-proxy");
  }

  public async openBrowser(proxyServer?: any): Promise<void> {
    if (!proxyServer) {
      vscode.window.showErrorMessage(
        "Proxy server is not running. Please start the server first."
      );
      return;
    }

    if (this.isInitialized) {
      console.log("Browser is already initialized.");
      await this.page?.bringToFront();
      return;
    }

    const playwright = await import("playwright-core");
    this.browser = await playwright.chromium.launch({
      headless: this.config.get("headless"),
      proxy: {
        server: `http://localhost:${this.config.get("port")}`,
      },
      executablePath: this.config.get("browserExecutablePath")
        ? this.config.get("browserExecutablePath")
        : undefined,
    });

    this.context = await this.browser.newContext({
      storageState: this.config.get("storageState"),
    });

    this.page = await this.context.newPage();
    await this.page.goto("https://qwen.aliyun.com/chat", {
      waitUntil: "networkidle",
    });

    this.isInitialized = true;
    console.log("Browser initialized successfully.");
  }

  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.context = undefined;
      this.page = undefined;
      this.isInitialized = false;
      console.log("Browser closed.");
    }
  }

  public async sendMessage(
    prompt: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    if (!this.isInitialized || !this.page) {
      throw new Error(
        "Browser not initialized. Please open the browser first."
      );
    }

    try {
      const filled = await this.fillChatInput(prompt);
      if (!filled) {
        throw new Error("Failed to find chat input field.");
      }

      await this.submitMessage();

      if (onChunk) {
        await this.pollResponse(onChunk);
        return ""; // Streaming handles its own output
      } else {
        const response = await this.pollResponse();
        return response;
      }
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
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
      const text = await element.textContent();
      if (text) {
        history.push(text.trim());
      }
    }

    return history;
  }

  public async clearCookies(): Promise<void> {
    if (this.context) {
      await this.context.clearCookies();
      console.log("Cookies cleared.");
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
    await input.fill(prompt);
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

  private async pollResponse(
    onChunk?: (c: string) => void,
    timeout = 30000
  ): Promise<string> {
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
        return all[all.length - 1]?.textContent || "";
      }, SELECTORS.response);

      if (cur.trim() !== last) {
        const delta = cur.slice(last.length);
        if (onChunk) {
          onChunk(delta);
        }
        last = cur.trim();
      }

      const isComplete = await this.page.evaluate((sel) => {
        return !!document.querySelector(sel);
      }, SELECTORS.complete);

      if (isComplete) break;
      await this.page.waitForTimeout(300);
    }
    return last.trim();
  }
}
