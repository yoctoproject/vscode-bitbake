import * as vscode from 'vscode';
import { createDebugConfiguration } from '../utils/launchConfigGenerator';
import { type BitbakeDriver } from '../driver/BitbakeDriver';

export async function debugCurrentFile(bitbakeDriver: BitbakeDriver) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active file to debug.');
        return;
    }
    const filePath = editor.document.fileName;

    try {
        // Create debug configuration
        const debugConfig = await createDebugConfiguration(bitbakeDriver, filePath);

        if (debugConfig) {
            // Start debug session with the created configuration
            const success = await vscode.debug.startDebugging(
                vscode.workspace.workspaceFolders?.[0],
                debugConfig
            );

            if (!success) {
                vscode.window.showErrorMessage('Failed to start debug session.');
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create debug configuration: ${error}`);
    }
}
