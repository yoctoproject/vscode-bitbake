import * as vscode from 'vscode';

export class OutputLogger {
  private static instance: OutputLogger | undefined;
  private static readonly outputChannelName = "BitBake";

  private outputChannel: vscode.OutputChannel;
  // default value in package.json
  private loggingLevel: string = '';

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel(OutputLogger.outputChannelName);
    this.loadSettings()
  }

  public loadSettings(): void {
    this.loggingLevel = vscode.workspace.getConfiguration('bitbake').get('loggingLevel') || 'info'
    this.info('Bitbake logging level: ' + this.loggingLevel)
  }

  public static getInstance(): OutputLogger {
    if (!OutputLogger.instance) {
      OutputLogger.instance = new OutputLogger();
    }
    return OutputLogger.instance;
  }

  public log(message: string, level: string = 'info'): void {
    if (this.shouldLog(level)) {
      this.outputChannel.appendLine(message);
      this.outputChannel.show();

      // Also log to the console (debug view)
      console.log(message);
    }
  }

  public info(message: string): void {
    this.log(message);
  }

  public debug(message: string): void {
    this.log(message, 'debug');
  }

  public warning(message: string): void {
    this.log(message, 'warning');
  }

  public error(message: string): void {
    this.log(message, 'error');
  }

  public clear(): void {
    this.outputChannel.clear();
  }

  private shouldLog(level: string): boolean {
    // Determine if the log level should be printed
    const logLevels = ['none', 'error', 'warning', 'info', 'debug'];
    const currentLevelIndex = logLevels.indexOf(this.loggingLevel);
    const messageLevelIndex = logLevels.indexOf(level);

    return currentLevelIndex >= messageLevelIndex;
  }
}

// Create and export the singleton logger instance
export const logger = OutputLogger.getInstance();
