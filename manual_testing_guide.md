# Qwen Client Manual Testing Guide

## Prerequisites

*   Node.js and npm installed
*   Project dependencies installed (run `npm install`)
*   A `.env` file configured with the necessary environment variables (e.g., Qwen API key)

## Testing Steps

1.  **Start the Extension:**
    *   Open the VS Code project.
    *   Press `F5` to start the extension in debug mode. This will launch a new VS Code window with the extension loaded.
2.  **Start the Qwen Proxy Server:**
    *   In the new VS Code window, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
    *   Type "Qwen Proxy: Start Server" and select the command.
    *   Observe the output in the Output panel (View -> Output, and select "Qwen Proxy").  Verify that the server starts without errors.
3.  **Test Browser Connection (Manual Verification):**
    *   After the server starts, the extension should attempt to launch a browser instance and navigate to the Qwen website.
    *   **Manually verify** that a browser window opens and displays the Qwen chat interface.
    *   If the browser does not open, check the Output panel for any error messages related to Puppeteer or browser launch.
4.  **Test Message Sending (Manual Verification):**
    *   In the VS Code window, use the "Qwen Proxy: Send Message" command.
    *   Enter a test message in the input box.
    *   **Manually verify** that the message is sent to the Qwen chat interface in the browser and that a response is received.
5.  **Test Authentication (If Applicable):**
    *   If authentication is required, follow the steps in the "Qwen Proxy: Open Browser to Login" command.
    *   Log in to your Qwen account in the browser.
    *   Test message sending again to ensure authentication is working.

## Expected Results

*   The Qwen Proxy server starts successfully.
*   A browser window opens and displays the Qwen chat interface.
*   Test messages are sent and responses are received in the browser.
*   Authentication (if required) is successful.

## Troubleshooting

*   **Browser fails to launch:**
    *   Ensure Puppeteer is installed correctly (check `package.json` for the dependency).
    *   Check the Output panel for Puppeteer-related error messages.
    *   Try setting the `browserExecutablePath` configuration option in the VS Code settings to the path of your browser executable.
*   **Authentication fails:**
    *   Verify your Qwen API key is correct in the `.env` file.
    *   Ensure you are logged in to your Qwen account in the browser.
    *   If using cookies, clear your browser cookies and try again.
*   **Selectors fail:**
    *   If the Qwen website UI changes, the selectors used by the extension may become invalid.  Check the Output panel for selector-related error messages.
    *   Update the selectors in the `qwen-client.ts` file if necessary.
