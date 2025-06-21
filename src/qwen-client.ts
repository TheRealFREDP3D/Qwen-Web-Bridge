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
  private isInitialized: boolean = false;
  private config: vscode.WorkspaceConfiguration;
  private extensionContext: vscode.ExtensionContext;
  private static readonly MAX_SCREENSHOTS = 20;
  private static outputChannel: vscode.OutputChannel =
    vscode.window.createOutputChannel("QwenClient");
  private screenshotsEnabled: boolean;

  constructor(context: vscode.ExtensionContext) {
    this.config = vscode.workspace.getConfiguration("qwen-proxy");
    this.extensionContext = context;
    this.screenshotsEnabled = this.config.get("enableScreenshots", false);
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      QwenClient.outputChannel.appendLine(
        "Qwen client is already initialized."
      );
      return;
    }

    QwenClient.outputChannel.appendLine("[QwenClient] Initializing...");
    try {
      const headless = this.config.get("headless", true)
        ? ("shell" as const)
        : (false as const);
      const executablePath = this.config.get<string>("browserExecutablePath");

      QwenClient.outputChannel.appendLine(
        `[QwenClient] Launching browser (headless: ${headless})`
      );
      this.browser = await puppeteer.launch({
        headless,
        executablePath: executablePath || undefined,
      });
      QwenClient.outputChannel.appendLine("[QwenClient] Browser launched.");

      this.page =
        (await this.browser.pages())[0] || (await this.browser.newPage());
      QwenClient.outputChannel.appendLine("[QwenClient] New page created.");

      await this.loadCookies();
      QwenClient.outputChannel.appendLine("[QwenClient] Cookies loaded.");

      QwenClient.outputChannel.appendLine("[QwenClient] Navigating to Qwen...");
      await this.page.goto("https://qwen.aliyun.com/chat", {
        waitUntil: "networkidle0",
      });
      QwenClient.outputChannel.appendLine("[QwenClient] Navigation complete.");

      // Take a screenshot after navigation if enabled
      if (this.screenshotsEnabled) {
        await this.takeScreenshot("after-navigation");
      }

      this.isInitialized = true;
      QwenClient.outputChannel.appendLine(
        "[QwenClient] Qwen client initialized successfully."
      );
    } catch (error: any) {
      QwenClient.outputChannel.appendLine(
        `[Error] [QwenClient] Failed to initialize Qwen client: ${error}`
      );
      this.isInitialized = false;
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    QwenClient.outputChannel.appendLine("[QwenClient] Cleaning up...");
    try {
      if (this.isInitialized) {
        QwenClient.outputChannel.appendLine("[QwenClient] Saving cookies...");
        await this.saveCookies();
        QwenClient.outputChannel.appendLine("[QwenClient] Cookies saved.");
      }
      if (this.browser) {
        QwenClient.outputChannel.appendLine("[QwenClient] Closing browser...");
        await this.browser.close();
        QwenClient.outputChannel.appendLine("[QwenClient] Browser closed.");
      }
    } finally {
      this.browser = undefined;
      this.page = undefined;
      this.isInitialized = false;
      QwenClient.outputChannel.appendLine(
        "[QwenClient] Qwen client cleaned up"
      );
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
    QwenClient.outputChannel.appendLine(
      `[QwenClient] Sending message: ${prompt}`
    );
    const filled = await this.fillChatInput(prompt);
    if (!filled) {
      throw new Error("Failed to find chat input field.");
    }

    // Take a screenshot before submitting the message if enabled
    if (this.screenshotsEnabled) {
      await this.takeScreenshot("before-submit");
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
    QwenClient.outputChannel.appendLine(
      `[QwenClient] Sending message (streaming): ${prompt}`
    );
    const filled = await this.fillChatInput(prompt);
    if (!filled) {
      throw new Error("Failed to find chat input field.");
    }

    // Take a screenshot before submitting the message if enabled
    if (this.screenshotsEnabled) {
      await this.takeScreenshot("before-submit-streaming");
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
          QwenClient.outputChannel.appendLine(
            `[Error] Failed to delete cookie file: ${e}`
          );
        }
      }
      QwenClient.outputChannel.appendLine("Cookies cleared.");
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
      const responseElements = await this.page.$$(SELECTORS.response);
      if (responseElements.length > 0) {
        const contentElement = responseElements[responseElements.length - 1];
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

  private async takeScreenshot(name: string): Promise<void> {
    if (!this.page) {
      QwenClient.outputChannel.appendLine(
        "[Warning] [QwenClient] takeScreenshot: page is not initialized"
      );
      return;
    }
    try {
      const screenshotPath = vscode.Uri.joinPath(
        this.extensionContext.globalStorageUri,
        `screenshot-${name}-${Date.now()}.png`
      );
      await this.page.screenshot({ path: screenshotPath.fsPath as any });
      QwenClient.outputChannel.appendLine(
        `[QwenClient] Screenshot saved: ${screenshotPath.fsPath}`
      );

      // Retention policy: limit the number of screenshots
      const files = await vscode.workspace.fs.readDirectory(
        this.extensionContext.globalStorageUri
      );
      const screenshotFiles = files
        .filter(
          ([file, type]) =>
            type === vscode.FileType.File &&
            file.startsWith("screenshot-") &&
            file.endsWith(".png")
        )
        .map(([file]) => file);

      if (screenshotFiles.length > QwenClient.MAX_SCREENSHOTS) {
        // Sort by timestamp in filename (assumes format: screenshot-<name>-<timestamp>.png)
        screenshotFiles.sort((a, b) => {
          const aMatch = a.match(/-(\d+)\.png$/);
          const bMatch = b.match(/-(\d+)\.png$/);
          const aTime = aMatch ? parseInt(aMatch[1], 10) : 0;
          const bTime = bMatch ? parseInt(bMatch[1], 10) : 0;
          return aTime - bTime;
        });
        const toDelete = screenshotFiles.slice(
          0,
          screenshotFiles.length - QwenClient.MAX_SCREENSHOTS
        );
        for (const file of toDelete) {
          const fileUri = vscode.Uri.joinPath(
            this.extensionContext.globalStorageUri,
            file
          );
          try {
            await vscode.workspace.fs.delete(fileUri);
            QwenClient.outputChannel.appendLine(
              `[QwenClient] Deleted old screenshot: ${fileUri.fsPath}`
            );
          } catch (err) {
            QwenClient.outputChannel.appendLine(
              `[Warning] [QwenClient] Failed to delete old screenshot: ${fileUri.fsPath} ${err}`
            );
          }
        }
      }
    } catch (error) {
      QwenClient.outputChannel.appendLine(
        `[Error] [QwenClient] Failed to take screenshot: ${error}`
      );
    }
  }
}
