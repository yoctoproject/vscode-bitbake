import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { type BitbakeDriver } from '../driver/BitbakeDriver'

// Utility to source BitBake environment script and return key env vars as dict
export async function getBitbakeEnvironmentVars(bitbakeDriver: BitbakeDriver, workspaceFolder: string): Promise<Record<string, string> | undefined> {
    const pathToEnvScriptRaw = bitbakeDriver.getBuildConfig('pathToEnvScript');
    if (!pathToEnvScriptRaw || typeof pathToEnvScriptRaw !== 'string') {
        vscode.window.showErrorMessage('BitBake environment script path is not set or invalid (bitbake.pathToEnvScript)');
        return;
    }
    // TypeScript now knows pathToEnvScriptRaw is a string after the type guard
    const pathToEnvScript: string = pathToEnvScriptRaw;
    // Compose shell command to source env script and print env vars
    const fullEnvScriptPath = path.isAbsolute(pathToEnvScript) ? pathToEnvScript : path.resolve(workspaceFolder, pathToEnvScript);
    const shellCmd = `sh -c '. "${fullEnvScriptPath}" >/dev/null 2>&1 && printf "BUILDDIR=%s\\nBBPATH=%s\\nPATH=%s\\nPYTHONPATH=%s\\n" "$BUILDDIR" "$BBPATH" "$PATH" "$PYTHONPATH"'`;
    return new Promise((resolve) => {
        exec(shellCmd, { cwd: workspaceFolder, env: process.env }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to source BitBake environment: ${stderr || error.message}`);
                resolve(undefined);
                return;
            }

            // Parse output into key=value pairs
            const lines = stdout.split('\n').filter(Boolean);
            const envVars: Record<string, string> = {};
            for (const line of lines) {
                const [key, ...rest] = line.split('=');
                if (key && rest.length) {
                    envVars[key] = rest.join('=');
                }
            }
            resolve(envVars);
        });
    });
}

// Generates a tasks.json file with a bitbake-server task
export function generateTasksJson(bitbakeDriver: BitbakeDriver, taskName: string, workspaceFolder: string) {
    const pathToEnvScriptRaw = bitbakeDriver.getBuildConfig('pathToEnvScript');
    if (!pathToEnvScriptRaw || typeof pathToEnvScriptRaw !== 'string') {
        vscode.window.showErrorMessage('BitBake environment script path is not set or invalid (bitbake.pathToEnvScript)');
        return;
    }
    // TypeScript now knows pathToEnvScriptRaw is a string after the type guard
    const pathToEnvScript: string = pathToEnvScriptRaw;
    const tasksJson = {
        version: '2.0.0',
        tasks: [
            {
                label: taskName,
                type: 'shell',
                command: `sh -c '. "${pathToEnvScript}" >/dev/null 2>&1 && bitbake --server-only -T 120'`,
                group: 'build',
                isBackground: false
            }
        ]
    };
    const vscodeDir = path.join(workspaceFolder, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir);
    }
    const tasksJsonPath = path.join(vscodeDir, 'tasks.json');
    fs.writeFileSync(tasksJsonPath, JSON.stringify(tasksJson, null, 4));
    vscode.window.showInformationMessage('BitBake server task added to .vscode/tasks.json');
}

export function generateLaunchConfig(program: string, taskName: string, workspaceFolder: string, args: string[] = [], envVars: Record<string, string> = {}) {
    // Accepts either script name or file path
    let programName: string;
    if (path.isAbsolute(program)) {
        programName = path.basename(program);
    } else {
        programName = program;
    }

    let programPath: string;
    if (path.isAbsolute(program)) {
        if (program.startsWith(workspaceFolder)) {
            // Absolute path within workspace - use ${workspaceFolder} placeholder
            programPath = program.replace(workspaceFolder, '${workspaceFolder}');
        } else {
            // Absolute path outside workspace - use as is
            programPath = program;
        }
    } else {
        // Relative path - prepend ${workspaceFolder}
        programPath = `\${workspaceFolder}/${program}`;
    }
    return {
        name: `Debug ${programName}`,
        type: 'debugpy',
        request: 'launch',
        program: programPath,
        console: 'integratedTerminal',
        args: args,
        env: envVars || {},
        cwd: '${workspaceFolder}',
        preLaunchTask: taskName
    };
}

// Shared function to create debug configuration
export async function createDebugConfiguration(bitbakeDriver: BitbakeDriver, program: string): Promise<any | null> {
    const bbServerTask = 'bitbake-server';
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    // Prompt user for arguments
    const argsInput = await vscode.window.showInputBox({
        prompt: `Enter arguments for ${program} (space-separated)`,
        value: ''
    });
    const args = argsInput ? argsInput.split(' ').filter(arg => arg.trim()) : [];

    // Create tasks.json for bitbake-server
    generateTasksJson(bitbakeDriver, bbServerTask, workspaceFolder);

    // Source environment and get env vars
    const envVars = await getBitbakeEnvironmentVars(bitbakeDriver, workspaceFolder);
    if (!envVars) {
        vscode.window.showWarningMessage('Failed to retrieve BitBake environment variables. Debug configuration will be created without environment setup.');
    }

    // Generate launch config with env vars (even if empty)
    const config = generateLaunchConfig(program, bbServerTask, workspaceFolder, args, envVars || {});

    // Write launch.json directly
    const vscodeDir = path.join(workspaceFolder, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir);
    }
    const launchJsonPath = path.join(vscodeDir, 'launch.json');
    let launchJson;
    if (fs.existsSync(launchJsonPath)) {
        launchJson = JSON.parse(fs.readFileSync(launchJsonPath, 'utf-8'));
    } else {
        launchJson = { version: '0.2.0', configurations: [] };
    }

    // Check if a configuration with the same name already exists
    const existingConfigIndex = launchJson.configurations.findIndex((existing: any) => existing.name === config.name);

    if (existingConfigIndex >= 0) {
        // Update existing configuration
        launchJson.configurations[existingConfigIndex] = config;
        vscode.window.showInformationMessage(`Debug configuration '${config.name}' updated in .vscode/launch.json.`);
    } else {
        // Add new configuration
        launchJson.configurations.push(config);
        vscode.window.showInformationMessage(`Debug configuration '${config.name}' added to .vscode/launch.json.`);
    }

    fs.writeFileSync(launchJsonPath, JSON.stringify(launchJson, null, 4));

    // Return the configuration object for potential use in starting a debug session
    return config;
}
