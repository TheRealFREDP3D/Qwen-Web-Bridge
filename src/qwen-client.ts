import puppeteer, { Browser, Page } from 'puppeteer';
import * as vscode from 'vscode';
import { OpenAIRequest } from './types';

export class QwenClient {
    private browser: Browser | undefined;
    private page: Page | undefined;
    private isInitialized = false;
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('qwen-proxy');
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log('Initializing Qwen client...');
            
            // Launch browser
            this.browser = await puppeteer.launch({
                headless: this.config.get('headless', true),
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            this.page = await this.browser.newPage();
            
            // Set user agent to avoid detection
            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );

            // Navigate to Qwen
            const qwenUrl = this.config.get('qwenUrl', 'https://qwen.alibaba.com');
            console.log(`Navigating to ${qwenUrl}...`);
            
            await this.page.goto(qwenUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait for the page to load and check if login is required
            await this.page.waitForTimeout(3000);
            
            // Check if we need to handle login or other setup
            await this.handleInitialSetup();
            
            this.isInitialized = true;
            console.log('Qwen client initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Qwen client:', error);
            await this.cleanup();
            throw error;
        }
    }

    private async handleInitialSetup(): Promise<void> {
        if (!this.page) return;

        try {
            // Check for login requirement
            const loginSelector = 'button[class*="login"], a[href*="login"], .login-button';
            const loginButton = await this.page.$(loginSelector);
            
            if (loginButton) {
                console.log('Login required - please login manually or configure authentication');
                // For now, we'll continue without login and see what happens
            }

            // Look for chat input or main interface
            const chatSelectors = [
                'textarea[placeholder*="ask"], textarea[placeholder*="question"]',
                'input[placeholder*="ask"], input[placeholder*="question"]',
                '.chat-input textarea',
                '.input-box textarea',
                '[data-testid="chat-input"]'
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
                console.warn('Could not find chat input - selectors may need updating');
            }

        } catch (error) {
            console.error('Error during initial setup:', error);
        }
    }

    async sendMessage(request: OpenAIRequest): Promise<string> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!this.page) {
            throw new Error('Page not initialized');
        }

        try {
            // Convert OpenAI messages to a single prompt
            const prompt = this.convertMessagesToPrompt(request.messages);
            
            // Find and fill the chat input
            const inputFilled = await this.fillChatInput(prompt);
            if (!inputFilled) {
                throw new Error('Could not find or fill chat input');
            }

            // Submit the message
            await this.submitMessage();

            // Wait for and extract the response
            const response = await this.waitForResponse();
            
            return response;

        } catch (error) {
            console.error('Error sending message to Qwen:', error);
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
            throw new Error('Page not initialized');
        }

        try {
            const prompt = this.convertMessagesToPrompt(request.messages);
            
            const inputFilled = await this.fillChatInput(prompt);
            if (!inputFilled) {
                throw new Error('Could not find or fill chat input');
            }

            await this.submitMessage();

            // Monitor for streaming response
            await this.waitForStreamingResponse(onChunk);

        } catch (error) {
            console.error('Error streaming message from Qwen:', error);
            throw error;
        }
    }

    private convertMessagesToPrompt(messages: Array<{ role: string; content: string }>): string {
        return messages
            .map(msg => {
                switch (msg.role) {
                    case 'system':
                        return `System: ${msg.content}`;
                    case 'user':
                        return `User: ${msg.content}`;
                    case 'assistant':
                        return `Assistant: ${msg.content}`;
                    default:
                        return msg.content;
                }
            })
            .join('\n\n');
    }

    private async fillChatInput(prompt: string): Promise<boolean> {
        if (!this.page) return false;

        const inputSelectors = [
            'textarea[placeholder*="ask"], textarea[placeholder*="question"]',
            'input[placeholder*="ask"], input[placeholder*="question"]',
            '.chat-input textarea',
            '.input-box textarea',
            '[data-testid="chat-input"]',
            'textarea:not([disabled])',
            '.ant-input'
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
            '.send-button',
            '[data-testid="send-button"]',
            'button[class*="send"]'
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
        await this.page.keyboard.press('Enter');
        console.log('Submitted message with Enter key');
    }

    private async waitForResponse(timeout = 30000): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        const responseSelectors = [
            '.message-content:last-child',
            '.chat-message:last-child .message-text',
            '.response-text',
            '[data-testid="assistant-message"]:last-child',
            '.ant-typography p'
        ];

        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            for (const selector of responseSelectors) {
                try {
                    const elements = await this.page.$$(selector);
                    if (elements.length > 0) {
                        const lastElement = elements[elements.length - 1];
                        const text = await lastElement.evaluate(el => el.textContent || '');
                        
                        if (text.trim().length > 0) {
                            console.log(`Got response with selector: ${selector}`);
                            return text.trim();
                        }
                    }
                } catch (error) {
                    // Continue trying other selectors
                }
            }
            
            await this.page.waitForTimeout(500);
        }

        throw new Error('Timeout waiting for response');
    }

    private async waitForStreamingResponse(onChunk: (chunk: string) => void): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        // This is a simplified streaming implementation
        // In reality, you'd need to monitor DOM changes more carefully
        let lastContent = '';
        const maxWaitTime = 30000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const currentContent = await this.waitForResponse(1000);
                
                if (currentContent !== lastContent) {
                    const newChunk = currentContent.substring(lastContent.length);
                    if (newChunk) {
                        onChunk(newChunk);
                        lastContent = currentContent;
                    }
                }
                
                // Check if response is complete (implementation depends on Qwen's UI)
                const isComplete = await this.page.evaluate(() => {
                    // Look for completion indicators
                    return document.querySelector('.response-complete, .generation-done') !== null;
                });
                
                if (isComplete) {
                    break;
                }
                
            } catch (error) {
                if (lastContent) {
                    break; // We got some content, consider it done
                }
                await this.page.waitForTimeout(500);
            }
        }
    }

    isConnected(): boolean {
        return this.isInitialized && !!this.browser && !!this.page;
    }

    async cleanup(): Promise<void> {
        try {
            if (this.browser) {
                await this.browser.close();
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        } finally {
            this.browser = undefined;
            this.page = undefined;
            this.isInitialized = false;
        }
    }
}