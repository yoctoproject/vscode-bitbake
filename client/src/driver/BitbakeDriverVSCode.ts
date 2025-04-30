/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2025 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { BitbakeDriver } from "./BitbakeDriver";
import { clientNotificationManager } from '../ui/ClientNotificationManager'
import { runBitbakeTerminalCustomCommand } from '../ui/BitbakeTerminal'
import { type IPty } from 'node-pty'

export class BitbakeDriverVSCode extends BitbakeDriver {
  logBitbakeSettingsError: (message: string) => void = clientNotificationManager.showBitbakeSettingsError.bind(clientNotificationManager)
  runTerminalCommand: (
    bitbakeDriver: BitbakeDriver,
    command: string,
    terminalName: string,
    isBackground?: boolean
  ) => Promise<IPty> = runBitbakeTerminalCustomCommand
}
