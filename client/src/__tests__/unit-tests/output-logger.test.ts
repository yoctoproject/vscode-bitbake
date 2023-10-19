/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { logger } from '../../ui/OutputLogger'

jest.mock('vscode')

const mockLoggerConfiguration = (loggingLevel: string): void => {
  vscode.workspace.getConfiguration = jest.fn().mockImplementation(() => ({
    get: () => loggingLevel
  }))
}

const mockChannel = (): jest.Mocked<any> => {
  const mockOutputChannel = {
    appendLine: jest.fn(),
    show: jest.fn(),
    clear: jest.fn()
  }

  vscode.window.createOutputChannel = jest.fn().mockImplementation(() => mockOutputChannel)

  return mockOutputChannel
}

describe('OutputLogger Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should define a singleton logger instance', () => {
    expect(logger).toBeDefined()
  })

  it('should correctly log messages with appropriate log level', () => {
    const mockOutputChannel = mockChannel()
    mockLoggerConfiguration('warning')

    logger.setOutputChannel(vscode.window.createOutputChannel('Bitbake'))
    logger.loadSettings()

    const logSpy = jest.spyOn(mockOutputChannel, 'appendLine')

    logger.debug('Debug message')
    logger.info('Info message')
    logger.warning('Warning message')
    logger.error('Error message')

    expect(logSpy).toHaveBeenCalledTimes(2)
    expect(logSpy).toHaveBeenCalledWith('Warning message')
    expect(logSpy).toHaveBeenCalledWith('Error message')
  })
})
