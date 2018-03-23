import * as constants from "../constants";
import * as semver from "semver";

export class NativescriptCloudExtensionService implements INativescriptCloudExtensionService {
	constructor(private $extensibilityService: IExtensibilityService,
		private $logger: ILogger,
		private $npmInstallationManager: INpmInstallationManager) { }

	public install(): Promise<IExtensionData> {
		if (!this.isInstalled()) {
			return this.$extensibilityService.installExtension(constants.NATIVESCRIPT_CLOUD_EXTENSION_NAME);
		}

		this.$logger.out(`Extension ${constants.NATIVESCRIPT_CLOUD_EXTENSION_NAME} is already installed.`);
	}

	public isInstalled(): boolean {
		return !!this.getExtensionData();
	}

	public async isLatestVersionInstalled(): Promise<boolean> {
		const extensionData = this.getExtensionData();
		if (extensionData) {
			const latestVersion = await this.$npmInstallationManager.getLatestVersion(constants.NATIVESCRIPT_CLOUD_EXTENSION_NAME);
			return semver.eq(latestVersion, extensionData.version);
		}

		return false;
	}

	private getExtensionData(): IExtensionData {
		return this.$extensibilityService.getInstalledExtensionsData()
			.find(extensionData => extensionData.extensionName === constants.NATIVESCRIPT_CLOUD_EXTENSION_NAME);
	}
}
$injector.register("nativescriptCloudExtensionService", NativescriptCloudExtensionService);
