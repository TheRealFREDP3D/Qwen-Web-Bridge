# Qwen Proxy VSCode Extension - Phase 2 Development Guide

## Project Analysis Summary

The Qwen Proxy VSCode Extension creates a bridge between VSCode and the Qwen AI service by:

1. Running an Express server that provides OpenAI-compatible API endpoints
2. Using Puppeteer to automate browser interactions with the Qwen web interface
3. Exposing VSCode commands to manage the proxy server

The core components are:

- `extension.ts`: VSCode extension entry point with command registration
- `server.ts`: Express server with OpenAI-compatible endpoints
- `qwen-client.ts`: Puppeteer-based client for Qwen web interface interaction
- `types.ts`: TypeScript type definitions

## Current Status

The project has completed **Phase 1 (Basic Setup)** and is now moving to **Phase 2: Web Automation**. The code for the Puppeteer connection is implemented but needs testing.

## Detailed Plan for Phase 2

### 1. Test Puppeteer Connection to Qwen

1. **Create a test script for Puppeteer connection**
   - Create a new file in the test directory specifically for testing the Qwen client
   - Implement tests for browser initialization, navigation to Qwen, and basic interactions

2. **Implement manual testing procedure**
   - Create a step-by-step guide for manually testing the Puppeteer connection
   - Document expected behaviors and potential issues

3. **Add debugging capabilities**
   - Enhance logging in the Qwen client for better visibility into the Puppeteer interactions
   - Add screenshot capture functionality for debugging purposes

### 2. Implement Basic Message Sending

1. **Test message sending functionality**
   - Create tests for the `sendMessage` and `sendMessageStream` methods
   - Verify proper handling of different message formats

2. **Improve error handling**
   - Add more robust error handling for common Puppeteer/browser issues
   - Implement retry mechanisms for transient failures

3. **Enhance selector robustness**
   - Review and improve the selectors used to interact with the Qwen interface
   - Add fallback mechanisms for when selectors change

### 3. Handle Authentication Requirements

1. **Implement authentication flow testing**
   - Test the cookie saving/loading functionality
   - Verify the manual login process works correctly

2. **Enhance authentication error handling**
   - Add clear error messages for authentication failures
   - Implement automatic detection of login requirements

3. **Document authentication process**
   - Create user documentation for the authentication flow
   - Add troubleshooting steps for common authentication issues

### 4. Debug Web Selectors

1. **Create selector testing utility**
   - Implement a utility to test and validate selectors on the Qwen website
   - Add functionality to suggest alternative selectors when the primary ones fail

2. **Implement selector versioning**
   - Add version checking for the Qwen website to handle interface changes
   - Create a mechanism to update selectors when the website changes

3. **Add visual debugging tools**
   - Implement screenshot capture at key points in the interaction
   - Create visual indicators for element selection

## Implementation Plan

### Week 1: Puppeteer Connection Testing

#### Day 1-2: Setup Testing Environment

- [x] Create `test/qwen-client.test.ts` file
- [x] Implement basic connection tests
- [x] Add manual testing documentation

#### Day 3-4: Enhance Debugging

- [x] Add detailed logging to Qwen client
- [x] Implement screenshot capture for debugging
- [ ] Create debugging guide for common issues

#### Day 5: Review and Refine

- [ ] Test on different environments
- [ ] Document any environment-specific issues
- [ ] Refine the testing approach based on findings

### Week 2: Message Sending and Authentication

#### Day 1-2: Message Sending Tests

- [ ] Implement tests for basic message sending (Partial: streaming and message sending implemented in code, but not fully tested)
- [ ] Test streaming functionality (Partial: implemented in code, but not fully tested)
- [ ] Verify handling of different message formats

#### Day 3-4: Authentication Testing

- [x] Test cookie handling
- [ ] Verify manual login process
- [ ] Implement authentication error detection

#### Day 5: Selector Debugging

- [ ] Create selector testing utility (Partial: selector fallback logic present, but no dedicated utility)
- [ ] Test selectors against the live Qwen website
- [ ] Document selector-related issues and solutions

## Success Metrics for Phase 2

- [x] Puppeteer successfully connects to Qwen website
- [ ] Basic message sending works reliably (Partial: implemented, not fully tested)
- [ ] Authentication flow is robust and user-friendly (Partial: cookie handling implemented)
- [ ] Selectors are resilient to minor UI changes (Partial: fallback logic present, no utility)
- [ ] Comprehensive test coverage for the Qwen client (Partial: connection tests present, message/streaming tests missing)
- [x] Clear documentation for testing and troubleshooting (manual testing guide present)

## Code Implementations

### 1. Test File for Qwen Client

```typescript
// test/qwen-client.test.ts
import { QwenClient } from "../src/qwen-client";

// Mock VSCode ExtensionContext
const mockContext = {
  globalState: {
    get: jest.fn(),
    update: jest.fn()
  },
  globalStorageUri: { fsPath: '/mock/path' }
} as any;

describe("QwenClient", () => {
  let client: QwenClient;
  
  beforeEach(() => {
    client = new QwenClient(mockContext);
  });
  
  afterEach(async () => {
    await client.cleanup();
  });
  
  it("should initialize successfully", async () => {
    // Test implementation
  });
  
  // Additional tests
});
```

### 2. Manual Testing Guide

```markdown
# Qwen Client Manual Testing Guide

## Prerequisites
- Node.js installed
- Project dependencies installed
- .env file configured

## Testing Steps
1. Start the extension in debug mode
2. Run the "Qwen Proxy: Start Server" command
3. Check server status
4. Test browser connection
5. Test message sending

## Expected Results
- Server should start without errors
- Browser should connect to Qwen website
- Messages should be sent and responses received

## Troubleshooting
- If browser fails to launch, check Puppeteer installation
- If authentication fails, use "Open Browser to Login" command
- If selectors fail, check console for detailed error messages
```

### 3. Enhanced Logging for Qwen Client

```typescript
// Enhanced logging example for qwen-client.ts
private async initialize(): Promise<void> {
  if (this.isInitialized) {
    console.log("[QwenClient] Already initialized.");
    return;
  }

  console.log("[QwenClient] Starting initialization...");
  try {
    const headless = this.config.get("headless", true)
      ? ("shell" as const)
      : (false as const);
    const executablePath = this.config.get<string>("browserExecutablePath");

    console.log(`[QwenClient] Launching browser (headless: ${headless})`);
    this.browser = await puppeteer.launch({
      headless,
      executablePath: executablePath || undefined,
    });

    console.log("[QwenClient] Browser launched successfully");
    this.page =
      (await this.browser.pages())[0] || (await this.browser.newPage());

    console.log("[QwenClient] Loading cookies...");
    await this.loadCookies();

    console.log("[QwenClient] Navigating to Qwen...");
    await this.page.goto("https://qwen.aliyun.com/chat", {
      waitUntil: "networkidle0",
    });
    console.log("[QwenClient] Navigation complete");

    this.isInitialized = true;
    console.log("[QwenClient] Initialization successful");
  } catch (error) {
    console.error("[QwenClient] Initialization failed:", error);
    this.isInitialized = false;
    throw error;
  }
}
```

## Success Metrics for Phase 2

- [x] Puppeteer successfully connects to Qwen website
- [ ] Basic message sending works reliably (Partial: implemented, not fully tested)
- [ ] Authentication flow is robust and user-friendly (Partial: cookie handling implemented)
- [ ] Selectors are resilient to minor UI changes (Partial: fallback logic present, no utility)
- [ ] Comprehensive test coverage for the Qwen client (Partial: connection tests present, message/streaming tests missing)
- [x] Clear documentation for testing and troubleshooting (manual testing guide present)

## Next Step Detailed Checklist (Phase 2)

### 1. Expand Automated Test Coverage

- [ ] Add unit/integration tests for `sendMessage` in `test/qwen-client.test.ts`
- [ ] Add unit/integration tests for `sendMessageStream` in `test/qwen-client.test.ts`
- [ ] Verify handling of different message formats (single, multi-turn, etc.)
- [ ] Add tests to simulate selector changes and ensure fallback logic works

### 2. Improve Authentication Flow

- [ ] Test the "Open Browser to Login" command and document the process
- [ ] Add clear error messages for authentication failures
- [ ] Implement automatic detection for login requirements

### 3. Debugging and Documentation

- [ ] Create a debugging guide for common Puppeteer/browser issues
- [ ] Add troubleshooting steps for common authentication issues
- [ ] Start a section in the docs for selector-related issues and solutions

### 4. Selector Utility (Optional, if time allows)

- [ ] Prototype a script or function to validate selectors against the live Qwen site
- [ ] Add functionality to suggest alternative selectors when the primary ones fail

## Next Steps After Phase 2

Once Phase 3 is complete, the project will move to Phase 4: API Integration, which will focus on:

1. Implementing OpenAI-compatible endpoints
2. Adding streaming support
3. Testing with coding assistants
4. Improving error handling
