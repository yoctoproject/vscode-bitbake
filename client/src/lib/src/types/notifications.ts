/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type EmbeddedLanguageDoc } from './embedded-languages'

enum NotificationType {
  EmbeddedLanguageDocs = 'EmbeddedLanguageDocs',
  RemoveScanResult = 'RemoveScanResult',
  ScanComplete = 'ScanComplete'
}

export const NotificationMethod: Record<NotificationType, string> = {
  [NotificationType.EmbeddedLanguageDocs]: 'bitbake/EmbeddedLanguageDocs',
  [NotificationType.RemoveScanResult]: 'bitbake/removeScanResult',
  [NotificationType.ScanComplete]: 'bitbake/ScanComplete'
}

export interface NotificationParams {
  [NotificationType.EmbeddedLanguageDocs]: EmbeddedLanguageDoc[]
  [NotificationType.RemoveScanResult]: { recipeName: string }
}
