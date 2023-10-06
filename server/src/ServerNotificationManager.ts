import { type Connection } from 'vscode-languageserver'

export type NotificationType =
  'custom/bitBakeNotFound'

export class ServerNotificationManager {
  private readonly _connection: Connection

  constructor (connection: Connection) {
    this._connection = connection
  }

  send (type: NotificationType, message?: string): void {
    void this._connection.sendNotification(type, message)
  }

  sendBitBakeNotFound (): void {
    this.send('custom/bitBakeNotFound')
  }
}
