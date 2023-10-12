import { logger } from "../ui/OutputLogger";
import { BitbakeSettings, loadBitbakeSettings } from "./BitbakeSettings";

export class BitbakeDriver {
  bitbakeSettings: BitbakeSettings = {  pathToBitbakeFolder: '', pathToBuildFolder: '', pathToEnvScript: '' }

  loadSettings() : void {
    this.bitbakeSettings = loadBitbakeSettings()
    logger.debug('BitbakeDriver settings updated: ' + JSON.stringify(this.bitbakeSettings))
  }
}
