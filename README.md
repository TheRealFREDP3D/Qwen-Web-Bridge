# 🧠 Qwen Bridge: VSCode Extension to Free AI Web Chat

The Qwen Bridge system enables AI-powered code assistance within VSCode using a local proxy and browser automation. Instead of calling paid OpenAI APIs, it interacts with a free web chat interface (like ChatGPT or Claude) using Puppeteer, emulating an OpenAI-compatible API endpoint.

---

## 🚀 Overview Workflow

This project uses a local bridge that:

- Accepts API-style requests from a VSCode extension (e.g., Cline)
- Automates browser interaction with a web-based AI chat
- Parses and returns the response as if it came from OpenAI's API

---

## 📊 Startup Lifecycle Diagram (v0.1.1)

### Mermaid Diagram

```mermaid
sequenceDiagram
    participant VSCode
    participant Extension
    participant QwenProxyServer
    participant QwenClient

    VSCode->>Extension: Activates extension
    Extension->>QwenProxyServer: Starts local server
    activate QwenProxyServer
    QwenProxyServer->>QwenClient: Initializes client
    activate QwenClient
    QwenClient->>QwenClient: Loads config & launches browser
    QwenClient-->>QwenProxyServer: Initialization complete
    deactivate QwenClient
    QwenProxyServer-->>Extension: Server running
    deactivate QwenProxyServer
```

---

## 🧬 Prompt-Response Processing Flow

### Mermaid Diagram

```mermaid
sequenceDiagram
    participant User
    participant Cline
    participant QwenProxyServer
    participant QwenClient
    participant "Web Chat UI"

    User->>Cline: Enters prompt
    Cline->>QwenProxyServer: Sends API request
    QwenProxyServer->>QwenClient: Forwards request
    QwenClient->>"Web Chat UI": Submits prompt via browser automation
    "Web Chat UI"-->>QwenClient: Streams back response
    QwenClient->>QwenClient: Parses and reformats response
    QwenClient-->>QwenProxyServer: Returns OpenAI-compatible response
    QwenProxyServer-->>Cline: Forwards response
    Cline-->>User: Displays result
```

---

## 🛠 Components

| Component               | Description                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| `Cline`                | VSCode extension acting as AI code assistant                               |
| `QwenProxyServer`      | Local server emulating OpenAI API                                           |
| `QwenClient`           | Bridge client that controls the browser and processes requests              |
| `Puppeteer`            | Headless browser automation library used to interact with the chat webpage |
| Web Chat Interface     | Target (e.g., ChatGPT, Claude) free web interface                           |

---

## ⚠️ Considerations

- Ensure you comply with the Terms of Service of any AI platform you interact with.
- Expect occasional breakage from site changes or CAPTCHAs.
- Add retry/backoff logic and rate limiting for safety.

---

## 📂 Roadmap

- [ ] Add support for multiple chat UIs (Claude, Gemini, etc.)
- [ ] Snapshot/restore chat sessions
- [ ] Toggle between local LLM and web chat backends
- [ ] Authentication via stored cookies/session replay

---

## 💬 Example Use Case

1. Developer types: `"Explain the difference between map and flatMap in JavaScript"`
2. Cline sends request to QwenProxyServer
3. Browser automation submits it to ChatGPT
4. Response is extracted and returned to the extension
5. Seamless integration without OpenAI API costs

---

![Chat Completion Request](docs/chat-completion-request.jpg)  
![Clear Cookies](docs/clear-cookies.jpg)  
![Open Browser to Login](docs/Open-Browser-to-Login.jpg)

```mermaid
classDiagram
    class QwenClient {
        - Browser browser
        - Page page
        - boolean isInitialized
        - vscode.WorkspaceConfiguration config
        - vscode.ExtensionContext context
        + constructor(context)
        + initialize()
        + sendMessage(request: OpenAIRequest): Promise<string>
        + sendMessageStream(request: OpenAIRequest, onChunk): Promise<void>
        + isConnected(): boolean
        + cleanup(): Promise<void>
        + clearCookies(): Promise<void>
        + openBrowser(): Promise<void>
        - handleInitialSetup(): Promise<void>
        - convertMessagesToPrompt(messages): string
        - fillChatInput(prompt): Promise<boolean>
        - submitMessage(): Promise<void>
        - waitForResponse(timeout): Promise<string>
        - waitForStreamingResponse(onChunk): Promise<void>
        - saveCookies(): Promise<void>
        - loadCookies(): Promise<void>
    }

    class QwenProxyServer {
        - express.Application app
        - http.Server server
        - QwenClient qwenClient
        - number port
        - boolean isServerRunning
        - vscode.ExtensionContext context
        + constructor(context)
        + start(): Promise<void>
        + stop(): Promise<void>
        + isRunning(): boolean
        + getPort(): number
        + clearCookies(): Promise<void>
        + openBrowser(): Promise<void>
        - setupMiddleware()
        - setupRoutes()
        - handleNonStreamingRequest(request, res)
        - handleStreamingRequest(request, res)
        - estimateTokens(messages): number
    }

    QwenProxyServer --> QwenClient : uses
    QwenClient --> vscode.ExtensionContext : depends on
    QwenProxyServer --> vscode.ExtensionContext : depends on
```
