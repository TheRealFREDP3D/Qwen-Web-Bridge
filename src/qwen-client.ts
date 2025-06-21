import puppeteer, { Browser, Page } from 'puppeteer';
import * as vscode from 'vscode';
import { OpenAIRequest } from './types';

const COOKIE_STORAGE_KEY = "qwen-proxy.cookies";

export class QwenClient {
  private browser: Browser | undefined;
  private page: Page | undefined;
  private isInitialized = false;
  private config: vscode.WorkspaceConfiguration;

  constructor(private context: vscode.ExtensionContext) {
    this.config = vscode.workspace.getConfiguration("qwen-proxy");
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log("Initializing Qwen client...");

      // Launch browser
      this.browser = await puppeteer.launch({
        headless: this.config.get("headless", true),
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      });

      this.page = await this.browser.newPage();

      // Set user agent to avoid detection
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Load cookies to restore session
      await this.loadCookies();

      // Navigate to Qwen
      const qwenUrl = this.config.get("qwenUrl", "https://qwen.alibaba.com");
      console.log(`Navigating to ${qwenUrl}...`);

      await this.page.goto(qwenUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Wait for the page to load and check if login is required
      await this.page.waitForTimeout(3000);

      // Check if we need to handle login or other setup
      await this.handleInitialSetup();

      this.isInitialized = true;
      console.log("Qwen client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Qwen client:", error);
      await this.cleanup();
      throw error;
    }
  }

  private async handleInitialSetup(): Promise<void> {
    if (!this.page) return;

    try {
      // Check for login requirement
      const loginSelector =
        'button[class*="login"], a[href*="login"], .login-button';
      const loginButton = await this.page.$(loginSelector);

      if (loginButton) {
        console.log(
          "Login required - please login manually or configure authentication"
        );
        vscode.window.showWarningMessage(
          'Qwen login may be required. Please use the "Qwen Proxy: Open Browser" command to log in.'
        );
      }

      // Look for chat input or main interface
      const chatSelectors = [
        'textarea[placeholder*="ask"], textarea[placeholder*="question"]',
        'input[placeholder*="ask"], input[placeholder*="question"]',
        ".chat-input textarea",
        ".input-box textarea",
        '[data-testid="chat-input"]',
      ];

      let chatInput = null;
      for (const selector of chatSelectors) {
        chatInput = await this.page.$(selector);
        if (chatInput) {
          console.log(`Found chat input with selector: ${selector}`);
          break;
        }
      }

      if (!chatInput) {
        console.warn("Could not find chat input - selectors may need updating");
      }
    } catch (error) {
      console.error("Error during initial setup:", error);
    }
  }

  async sendMessage(request: OpenAIRequest): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.page) {
      throw new Error("Page not initialized");
    }

    try {
      // Convert OpenAI messages to a single prompt
      const prompt = this.convertMessagesToPrompt(request.messages);

      // Find and fill the chat input
      const inputFilled = await this.fillChatInput(prompt);
      if (!inputFilled) {
        throw new Error("Could not find or fill chat input");
      }

      // Submit the message
      await this.submitMessage();

      // Wait for and extract the response
      const response = await this.waitForResponse();

      return response;
    } catch (error) {
      console.error("Error sending message to Qwen:", error);
      throw error;
    }
  }

  async sendMessageStream(
    request: OpenAIRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.page) {
      throw new Error("Page not initialized");
    }

    try {
      const prompt = this.convertMessagesToPrompt(request.messages);

      const inputFilled = await this.fillChatInput(prompt);
      if (!inputFilled) {
        throw new Error("Could not find or fill chat input");
      }

      await this.submitMessage();

      // Monitor for streaming response
      await this.waitForStreamingResponse(onChunk);
    } catch (error) {
      console.error("Error streaming message from Qwen:", error);
      throw error;
    }
  }

  private convertMessagesToPrompt(
    messages: Array<{ role: string; content: string }>
  ): string {
    return messages
      .map((msg) => {
        switch (msg.role) {
          case "system":
            return `System: ${msg.content}`;
          case "user":
            return `User: ${msg.content}`;
          case "assistant":
            return `Assistant: ${msg.content}`;
          default:
            return msg.content;
        }
      })
      .join("\n\n");
  }

  private async fillChatInput(prompt: string): Promise<boolean> {
    if (!this.page) return false;

    const inputSelectors = [
      'textarea[placeholder*="ask"], textarea[placeholder*="question"]',
      'input[placeholder*="ask"], input[placeholder*="question"]',
      ".chat-input textarea",
      ".input-box textarea",
      '[data-testid="chat-input"]',
      "textarea:not([disabled])",
      ".ant-input",
    ];

    for (const selector of inputSelectors) {
      try {
        const input = await this.page.$(selector);
        if (input) {
          await input.click();
          await input.type(prompt);
          console.log(`Successfully filled input with selector: ${selector}`);
          return true;
        }
      } catch (error) {
        console.log(`Failed to use selector ${selector}:`, error);
      }
    }

    return false;
  }

  private async submitMessage(): Promise<void> {
    if (!this.page) return;

    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Send")',
      'button:has-text("发送")',
      ".send-button",
      '[data-testid="send-button"]',
      'button[class*="send"]',
    ];

    for (const selector of submitSelectors) {
      try {
        const button = await this.page.$(selector);
        if (button) {
          await button.click();
          console.log(`Clicked submit button with selector: ${selector}`);
          return;
        }
      } catch (error) {
        console.log(`Failed to click button ${selector}:`, error);
      }
    }

    // Fallback: try Enter key
    await this.page.keyboard.press("Enter");
    console.log("Submitted message with Enter key");
  }

  private async waitForResponse(timeout = 30000): Promise<string> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    const responseSelector =
      '.message-content, .response-text, [data-testid="message-content"]';

    try {
      await this.page.waitForSelector(responseSelector, { timeout });

      // Give it a moment for the content to stabilize
      await this.page.waitForTimeout(1000);

      const lastResponse = await this.page.evaluate(() => {
        const responseNodes = document.querySelectorAll(
          '.message-content, .response-text, [data-testid="message-content"]'
        );
        return responseNodes[responseNodes.length - 1]?.textContent || "";
      });

      return lastResponse.trim();
    } catch (error) {
      console.error("Error waiting for response:", error);
      throw new Error("Could not get response from Qwen");
    }
  }

  private async waitForStreamingResponse(
    onChunk: (chunk: string) => void
  ): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    const responseSelector =
      '.message-content, .response-text, [data-testid="message-content"]';
    let lastContent = "";

    try {
      const observer = new MutationObserver(async () => {
        const currentContent = await this.page!.evaluate(() => {
          const responseNodes = document.querySelectorAll(responseSelector);
          return responseNodes[responseNodes.length - 1]?.textContent || "";
        });

        if (currentContent.length > lastContent.length) {
          const newChunk = currentContent.substring(lastContent.length);
          onChunk(newChunk);
          lastContent = currentContent;
        }
      });

      await this.page.exposeFunction("onMutation", () => observer.disconnect());

      await this.page.evaluate((selector) => {
        const targetNode = document.querySelector(selector);
        if (targetNode) {
          const obs = new MutationObserver(() => (window as any).onMutation());
          obs.observe(targetNode, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        }
      }, responseSelector);

      // Wait for a signal that streaming is complete (e.g., a specific element appears)
      await this.page.waitForSelector(".some-completion-indicator", {
        timeout: 60000,
      });
    } catch (error) {
      console.warn("Streaming may have ended without a clear signal:", error);
    }
  }

  isConnected(): boolean {
    return this.isInitialized && !!this.browser && !!this.page;
  }

  async cleanup(): Promise<void> {
    if (this.isInitialized) {
      await this.saveCookies();
    }

    if (this.browser) {
      await this.browser.close();
    }

    this.browser = undefined;
    this.page = undefined;
    this.isInitialized = false;
    console.log("Qwen client cleaned up");
  }

  async clearCookies(): Promise<void> {
    await this.context.globalState.update(COOKIE_STORAGE_KEY, null);
    console.log("Qwen cookies cleared.");
  }

  private async saveCookies(): Promise<void> {
    if (!this.page) return;

    try {
      const cookies = await this.page.cookies();
      await this.context.globalState.update(
        COOKIE_STORAGE_KEY,
        JSON.stringify(cookies)
      );
      console.log("Qwen cookies saved.");
    } catch (error) {
      console.error("Failed to save Qwen cookies:", error);
    }
  }

  private async loadCookies(): Promise<void> {
    if (!this.page) return;

    try {
      const cookiesString =
        this.context.globalState.get<string>(COOKIE_STORAGE_KEY);
      if (cookiesString) {
        const cookies = JSON.parse(cookiesString);
        await this.page.setCookie(...cookies);
        console.log("Qwen cookies loaded.");
      }
    } catch (error) {
      console.error("Failed to load Qwen cookies:", error);
    }
  }

  async openBrowser(): Promise<void> {
    if (this.isInitialized) {
      await this.cleanup();
    }

    this.config.update("headless", false, vscode.ConfigurationTarget.Global);
    await this.initialize();
  }
}
