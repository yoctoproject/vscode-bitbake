/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

enum NotificationType {
  FilenameChanged = 'FilenameChanged'
}

export const NotificationMethod: Record<NotificationType, string> = {
  [NotificationType.FilenameChanged]: 'custom/fileNameChanged'
}

export interface NotificationParams {
  [NotificationType.FilenameChanged]: NotifyFileNameChangeParams
}

interface NotifyFileNameChangeParams {
  oldUriString: string
  newUriString: string
}
