/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type IPty } from 'node-pty'
import { type KillProcessFunction } from './ProcessUtils'

export interface ProcessDimensions {
  columns: number
  rows: number
}

// Deferred spawning lets the frontend reserve a terminal and obtain its dimensions first.
export type ProcessSpawner = (dimensions: ProcessDimensions | undefined) => Promise<IPty>

export interface ProcessRunOptions {
  name?: string
  background?: boolean
  cancel?: KillProcessFunction
}

// A process frontend presents one execution and returns after attaching its event handlers.
// Completion and output capture remain the responsibility of finishProcessExecution.
export interface ProcessFrontend {
  runProcess: (spawn: ProcessSpawner, command: string, options?: ProcessRunOptions) => Promise<IPty>
}
