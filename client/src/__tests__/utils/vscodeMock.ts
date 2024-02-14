/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

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
