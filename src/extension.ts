import * as vscode from 'vscode';
import { QwenProxyServer } from './server';

let proxyServer: QwenProxyServer | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Qwen Proxy extension is now active');

    // Create proxy server instance
    proxyServer = new QwenProxyServer(context);

    // Register commands
    const startCommand = vscode.commands.registerCommand('qwen-proxy.start', async () => {
        try {
            await proxyServer?.start();
            vscode.window.showInformationMessage('Qwen Proxy server started successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start Qwen Proxy: ${error}`);
        }
    });

    const stopCommand = vscode.commands.registerCommand('qwen-proxy.stop', async () => {
        try {
            await proxyServer?.stop();
            vscode.window.showInformationMessage('Qwen Proxy server stopped');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to stop Qwen Proxy: ${error}`);
        }
    });

    const statusCommand = vscode.commands.registerCommand('qwen-proxy.status', () => {
        const isRunning = proxyServer?.isRunning() || false;
        const port = proxyServer?.getPort() || 'N/A';
        const status = isRunning ? 'Running' : 'Stopped';
        
        vscode.window.showInformationMessage(
            `Qwen Proxy Status: ${status}${isRunning ? ` on port ${port}` : ''}`
        );
    });

    const clearCookiesCommand = vscode.commands.registerCommand(
      "qwen-proxy.clearCookies",
      async () => {
        const confirm = await vscode.window.showWarningMessage(
          "Are you sure you want to clear Qwen cookies? This will log you out.",
          { modal: true },
          "Yes",
          "No"
        );
        if (confirm !== "Yes") {
          return;
        }
        try {
          await proxyServer?.clearCookies();
          vscode.window.showInformationMessage(
            "Qwen cookies cleared successfully"
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to clear Qwen cookies: ${error}`
          );
        }
      }
    );

    const openBrowserCommand = vscode.commands.registerCommand(
      "qwen-proxy.openBrowser",
      async () => {
        try {
          await proxyServer?.openBrowser();
          vscode.window.showInformationMessage(
            "Qwen browser opened. Please login and then restart the proxy."
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open Qwen browser: ${error}`
          );
        }
      }
    );

    // Auto-start if configured
    const config = vscode.workspace.getConfiguration('qwen-proxy');
    if (config.get('autoStart', true)) {
        proxyServer.start().catch(error => {
            console.error('Failed to auto-start Qwen Proxy:', error);
        });
    }

    // Register disposables
    context.subscriptions.push(
      startCommand,
      stopCommand,
      statusCommand,
      clearCookiesCommand,
      openBrowserCommand
    );

    // Show status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 
        100
    );
    statusBarItem.text = "$(globe) Qwen Proxy";
    statusBarItem.tooltip = "Click to check Qwen Proxy status";
    statusBarItem.command = 'qwen-proxy.status';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Update status bar based on server state
    const updateStatusBar = () => {
        if (proxyServer?.isRunning()) {
            statusBarItem.text = "$(check) Qwen Proxy";
            statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        } else {
            statusBarItem.text = "$(x) Qwen Proxy";
            statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        }
    };

    // Check status periodically
    const statusInterval = setInterval(updateStatusBar, 5000);
    context.subscriptions.push(new vscode.Disposable(() => clearInterval(statusInterval)));
}

export function deactivate() {
    console.log('Qwen Proxy extension is being deactivated');
    
    if (proxyServer) {
        proxyServer.stop().catch(error => {
            console.error('Error stopping proxy server during deactivation:', error);
        });
    }
}
