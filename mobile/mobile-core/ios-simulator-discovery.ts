import {DeviceDiscovery} from "./device-discovery";
import Future = require("fibers/future");
import {IOSSimulator} from "./../ios/simulator/ios-simulator-device";

export class IOSSimulatorDiscovery extends DeviceDiscovery {
	private cachedSimulator: Mobile.IiSimDevice;

	constructor(private $injector: IInjector,
		private $childProcess: IChildProcess,
		private $iOSSimResolver: Mobile.IiOSSimResolver,
		private $hostInfo: IHostInfo) {
		super();
	}

	public async startLookingForDevices(): Promise<void> {
		return this.checkForDevices(new Future<void>());
	}

	public async checkForDevices(future?: Promise<void>): Promise<void> {
		if (this.$hostInfo.isDarwin) {
			let currentSimulator:any = null;
			if (await this.isSimulatorRunning()) {
				currentSimulator = this.$iOSSimResolver.iOSSim.getRunningSimulator();
			}

			if (currentSimulator) {
				if (!this.cachedSimulator) {
					this.createAndAddDevice(currentSimulator);
				} else if (this.cachedSimulator.id !== currentSimulator.id) {
					this.removeDevice(this.cachedSimulator.id);
					this.createAndAddDevice(currentSimulator);
				}
			} else if (this.cachedSimulator) {
				// In case there's no running simulator, but it's been running before, we should report it as removed.
				this.removeDevice(this.cachedSimulator.id);
				this.cachedSimulator = null;
			}
		}

		if (future) {
			future.return();
		}

		return future || Promise.resolve();
	}

	private async isSimulatorRunning(): Promise<boolean> {
			try {
				let output = await  this.$childProcess.exec("ps cax | grep launchd_sim");
				return output.indexOf('launchd_sim') !== -1;
			} catch(e) {
				return false;
			}
	}

	private createAndAddDevice(simulator: Mobile.IiSimDevice): void {
		this.cachedSimulator = _.cloneDeep(simulator);
		this.addDevice(this.$injector.resolve(IOSSimulator, { simulator: this.cachedSimulator }));
	}
}

$injector.register("iOSSimulatorDiscovery", IOSSimulatorDiscovery);
