/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Connection } from 'vscode-languageserver'

let _connection: Connection | null = null

/**
 * Set the connection. Should be done at startup.
 */
export function setNotificationManagerConnection (connection: Connection): void {
  _connection = connection
}

export type NotificationType =
  'custom/bitBakeNotFound'

class ServerNotificationManager {
  send (type: NotificationType, message?: string): void {
    if (_connection === null) {
      // eslint-disable-next-line no-console
      console.warn('The LSP Connection is not set. Dropping messages')
      return
    }
    void _connection.sendNotification(type, message)
  }

  sendBitBakeNotFound (): void {
    this.send('custom/bitBakeNotFound')
  }
}

export const serverNotificationManager = new ServerNotificationManager()
