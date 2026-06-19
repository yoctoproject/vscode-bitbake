/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

export type StatusBarItemMock = vscode.StatusBarItem & {
  text: string
  command: string
  tooltip: string
  show: jest.Mock
  hide: jest.Mock
}

export type VscodeExtensionContextMock = vscode.ExtensionContext & {
  workspaceState: {
    get: jest.Mock
    update: jest.Mock
  }
}

export function createStatusBarItemMock (): StatusBarItemMock {
  return {
    text: '',
    command: '',
    tooltip: '',
    show: jest.fn(),
    hide: jest.fn()
  } as unknown as StatusBarItemMock
}

// This sets up a mock that will simulate the firing of vscode events
// The events are fired automatically when the event is created
export function mockVscodeEvents (): void {
  (vscode.EventEmitter as jest.Mock).mockImplementation(() => {
    return {
      fire: jest.fn(),
      event: jest.fn().mockImplementation((fn) => { fn(); return { dispose: jest.fn() } })
    }
  })
}

export function mockVscodeExtensionContext (): VscodeExtensionContextMock {
  return {
    subscriptions: {
      push: jest.fn()
    },
    workspaceState: {
      get: jest.fn(),
      update: jest.fn()
    }
  } as unknown as VscodeExtensionContextMock
}
