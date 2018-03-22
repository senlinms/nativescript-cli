import { Yok } from "../../lib/common/yok";
import { PlatformEnvironmentRequirements } from '../../lib/services/platform-environment-requirements';
import * as stubs from "../stubs";
import { assert } from "chai";

const platform = "android";
const cloudBuildsErrorMessage = `In order to test your application use the $ tns login command to log in with your account and then $ tns cloud build command to build your app in the cloud.`;
const manuallySetupErrorMessage = `To be able to build for ${platform}, verify that your environment is configured according to the system requirements described at `;
const nonInteractiveConsoleErrorMessage = `You are missing the nativescript-cloud extension and you will not be able to execute cloud builds. Your environment is not configured properly and you will not be able to execute local builds. To continue, choose one of the following options: \nRun $ tns setup command to run the setup script to try to automatically configure your environment for local builds.\nRun $ tns cloud setup command to install the nativescript-cloud extension to configure your environment for cloud builds.\nVerify that your environment is configured according to the system requirements described at `;

function createTestInjector() {
	const testInjector = new Yok();

	testInjector.register("commandsService", {currentCommandData: {commandName: "test", commandArguments: [""]}});
	testInjector.register("doctorService", {});
	testInjector.register("errors", {
		fail: (err: any) => {
			throw new Error(err.formatStr || err.message || err);
		}
	});
	testInjector.register("logger", stubs.LoggerStub);
	testInjector.register("prompter", {});
	testInjector.register("platformEnvironmentRequirements", PlatformEnvironmentRequirements);
	testInjector.register("staticConfig", { SYS_REQUIREMENTS_LINK: "" });
	testInjector.register("nativescriptCloudExtensionService", {});

	return testInjector;
}

let promptForChoiceData: {message: string, choices: string[]}[] = [];
function mockPrompter(testInjector: IInjector, data: {firstCallOptionName: string, secondCallOptionName?: string}) {
	const prompter = testInjector.resolve("prompter");
	prompter.promptForChoice = (message: string, choices: string[]) => {
		promptForChoiceData.push({message: message, choices: choices});

		if (choices.length === 4) { // TODO: Consider to refactor this
			return Promise.resolve(data.firstCallOptionName);
		}

		if (data.secondCallOptionName) {
			return Promise.resolve(data.secondCallOptionName);
		}
	};
}

let isExtensionInstallCalled = false;
function mockNativescriptCloudExtensionService(testInjector: IInjector, data: {isInstalled: boolean}) {
	const nativescriptCloudExtensionService = testInjector.resolve("nativescriptCloudExtensionService");
	nativescriptCloudExtensionService.isInstalled = () => data.isInstalled;
	nativescriptCloudExtensionService.install = () => { isExtensionInstallCalled = true; };
}

function mockDoctorService(testInjector: IInjector, data: {canExecuteLocalBuild: boolean, mockSetupScript?: boolean}) {
	const doctorService = testInjector.resolve("doctorService");
	doctorService.canExecuteLocalBuild = () => data.canExecuteLocalBuild;
	if (data.mockSetupScript) {
		doctorService.runSetupScript = () => Promise.resolve();
	}
}

describe("platformEnvironmentRequirements ", () => {
	describe.only("checkRequirements", () => {
		let testInjector: IInjector = null;
		let platformEnvironmentRequirements: IPlatformEnvironmentRequirements = null;

		beforeEach(() => {
			testInjector = createTestInjector();
			platformEnvironmentRequirements = testInjector.resolve("platformEnvironmentRequirements");
			process.stdout.isTTY = true;
			process.stdin.isTTY = true;
		});

		afterEach(() => {
			promptForChoiceData = [];
			isExtensionInstallCalled = false;
		});

		it("should return true when environment is configured", async () => {
			mockDoctorService(testInjector, {canExecuteLocalBuild: true});
			const result = await platformEnvironmentRequirements.checkEnvironmentRequirements(platform);
			assert.isTrue(result);
			assert.isTrue(promptForChoiceData.length === 0);
		});
		it("should show prompt when environment is not configured and nativescript-cloud extension is not installed", async () => {
			mockDoctorService(testInjector, {canExecuteLocalBuild: false});
			mockPrompter(testInjector, {firstCallOptionName: PlatformEnvironmentRequirements.CLOUD_SETUP_OPTION_NAME});
			mockNativescriptCloudExtensionService(testInjector, { isInstalled: false });

			await assert.isRejected(platformEnvironmentRequirements.checkEnvironmentRequirements(platform));
			assert.isTrue(promptForChoiceData.length === 1);
			assert.isTrue(isExtensionInstallCalled);
			assert.deepEqual("To continue, choose one of the following options: ", promptForChoiceData[0].message);
			assert.deepEqual([ 'Configure for Cloud Builds', 'Configure for Local Builds', 'Configure for Both Local and Cloud Builds', 'Skip Step and Configure Manually' ], promptForChoiceData[0].choices);
		});
		it("should show prompt when environment is not configured and nativescript-cloud extension is installed", async () => {
			mockDoctorService(testInjector, {canExecuteLocalBuild: false});
			mockPrompter(testInjector, {firstCallOptionName: PlatformEnvironmentRequirements.CLOUD_SETUP_OPTION_NAME});
			mockNativescriptCloudExtensionService(testInjector, { isInstalled: true });

			await platformEnvironmentRequirements.checkEnvironmentRequirements(platform);
			assert.isTrue(promptForChoiceData.length === 1);
			assert.isFalse(isExtensionInstallCalled);
			assert.deepEqual("To continue, choose one of the following options: ", promptForChoiceData[0].message);
			assert.deepEqual([ 'Configure for Local Builds', 'Skip Step and Configure Manually' ], promptForChoiceData[0].choices);
		});
		
		describe("when local setup option is selected", () => {
			beforeEach(() => {
				mockPrompter(testInjector, {firstCallOptionName: PlatformEnvironmentRequirements.LOCAL_SETUP_OPTION_NAME});
			});

			it("should return true when env is configured after executing setup script", async () => {
				const doctorService = testInjector.resolve("doctorService");
				doctorService.canExecuteLocalBuild = () => false;
				doctorService.runSetupScript = async () => { doctorService.canExecuteLocalBuild = () => true; };

				mockNativescriptCloudExtensionService(testInjector, {isInstalled: null});

				assert.isTrue(await platformEnvironmentRequirements.checkEnvironmentRequirements(platform));
			});

			describe("and env is not configured after executing setup script", () => {
				it("should setup manually when cloud extension is installed", async () => {
					mockDoctorService(testInjector, { canExecuteLocalBuild: false, mockSetupScript: true });
					mockPrompter(testInjector, {firstCallOptionName: PlatformEnvironmentRequirements.LOCAL_SETUP_OPTION_NAME, secondCallOptionName: PlatformEnvironmentRequirements.MANUALLY_SETUP_OPTION_NAME})
					mockNativescriptCloudExtensionService(testInjector, { isInstalled: true });

					await assert.isRejected(platformEnvironmentRequirements.checkEnvironmentRequirements(platform), manuallySetupErrorMessage);
				});
				describe("and cloud extension is not installed", () => {
					beforeEach(() => {
						mockDoctorService(testInjector, {canExecuteLocalBuild: false, mockSetupScript: true});
						mockNativescriptCloudExtensionService(testInjector, {isInstalled: false});
					});
					it("should list 2 posibile options to select", async () => {
						mockPrompter(testInjector, {firstCallOptionName: PlatformEnvironmentRequirements.LOCAL_SETUP_OPTION_NAME});
	
						await platformEnvironmentRequirements.checkEnvironmentRequirements(platform);
						assert.deepEqual(promptForChoiceData[1].choices, [ 'Configure for Cloud Builds', 'Skip Step and Configure Manually' ]);
					});
					it("should install nativescript-cloud extension when 'Configure for Cloud Builds' option is selected", async () => {
						mockPrompter(testInjector, {firstCallOptionName: PlatformEnvironmentRequirements.LOCAL_SETUP_OPTION_NAME, secondCallOptionName: PlatformEnvironmentRequirements.CLOUD_SETUP_OPTION_NAME});
	
						await assert.isRejected(platformEnvironmentRequirements.checkEnvironmentRequirements(platform), cloudBuildsErrorMessage);
						assert.deepEqual(isExtensionInstallCalled, true);
					});
					it("should setup manually when 'Skip Step and Configure Manually' option is selected", async () => {
						mockPrompter(testInjector, {firstCallOptionName: PlatformEnvironmentRequirements.LOCAL_SETUP_OPTION_NAME, secondCallOptionName: PlatformEnvironmentRequirements.MANUALLY_SETUP_OPTION_NAME});
						await assert.isRejected(platformEnvironmentRequirements.checkEnvironmentRequirements(platform), manuallySetupErrorMessage);
					});
				});
			});
		});

		describe("when cloud setup option is selected", () => {
			it("should install nativescript-cloud extension", async () => {
				mockDoctorService(testInjector, {canExecuteLocalBuild: false});
				mockPrompter(testInjector, {firstCallOptionName: PlatformEnvironmentRequirements.CLOUD_SETUP_OPTION_NAME});
				mockNativescriptCloudExtensionService(testInjector, {isInstalled: false});

				await assert.isRejected(platformEnvironmentRequirements.checkEnvironmentRequirements(platform), cloudBuildsErrorMessage);
				assert.isTrue(isExtensionInstallCalled);
			});
		});

		describe("when manually setup option is selected", () => {
			it("should fail when manually setup option is selected", async () => {
				const doctorService = testInjector.resolve("doctorService");
				doctorService.canExecuteLocalBuild = () => false;

				const prompter = testInjector.resolve("prompter");
				prompter.promptForChoice = () => PlatformEnvironmentRequirements.MANUALLY_SETUP_OPTION_NAME;

				await assert.isRejected(platformEnvironmentRequirements.checkEnvironmentRequirements(platform), manuallySetupErrorMessage);
			});
		});

		describe("when console is not interactive", () => {
			it("should fail when console is not interactive", async () => {
				process.stdout.isTTY = false;
				process.stdin.isTTY = false;

				const doctorService = testInjector.resolve("doctorService");
				doctorService.canExecuteLocalBuild = () => false;

				await assert.isRejected(platformEnvironmentRequirements.checkEnvironmentRequirements(platform), nonInteractiveConsoleErrorMessage);
			});
		});
	});
});
