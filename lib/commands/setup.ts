export class SetupCommand implements ICommand {
	public allowedParameters: ICommandParameter[] = [];

	constructor(private $doctorService: IDoctorService) { }

	public execute(args: string[]): Promise<any> {
		return this.$doctorService.runSetupScript();
	}
}
$injector.registerCommand("setup|*", SetupCommand);

export class CloudSetupCommand implements ICommand {
	public allowedParameters: ICommandParameter[] = [];

	constructor(private $nativescriptCloudExtensionService: INativescriptCloudExtensionService) { }

	public execute(args: string[]): Promise<any> {
		return this.$nativescriptCloudExtensionService.install();
	}
}
$injector.registerCommand(["setup|cloud", "cloud|setup"], CloudSetupCommand);
