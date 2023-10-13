import { logger } from "../ui/OutputLogger";
import { BitbakeSettings, loadBitbakeSettings } from "./BitbakeSettings";

/// This class is responsible for wrapping up all bitbake classes and exposing them to the extension
export class BitbakeDriver {
  bitbakeSettings: BitbakeSettings = {  pathToBitbakeFolder: '', pathToBuildFolder: '', pathToEnvScript: '' }

  loadSettings() : void {
    this.bitbakeSettings = loadBitbakeSettings()
    logger.debug('BitbakeDriver settings updated: ' + JSON.stringify(this.bitbakeSettings))
  }
}
