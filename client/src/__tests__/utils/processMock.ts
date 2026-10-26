/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { EventEmitter } from 'events'
import { type IPty } from 'node-pty'

export function createProcessMock (): {
  child: IPty
  data: (data: string) => void
  exit: (exitCode: number) => void
} {
  const events = new EventEmitter()
  const child = {
    pid: 123,
    kill: jest.fn(),
    resize: jest.fn(),
    onData: jest.fn(listener => {
      events.on('data', listener)
      return { dispose: () => events.off('data', listener) }
    }),
    onExit: jest.fn(listener => {
      events.on('exit', listener)
      return { dispose: () => events.off('exit', listener) }
    })
  } as unknown as IPty
  return {
    child,
    data: data => { events.emit('data', data) },
    exit: exitCode => { events.emit('exit', { exitCode }) }
  }
}
