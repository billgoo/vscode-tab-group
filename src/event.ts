/**
 * When an change event is fired, prevent mutual event triggering (infinite loop)
 */
export class ExclusiveHandle {
	private running: Promise<any> | undefined = undefined;

	run<T = void>(listener: () => Promise<T> | T): Promise<T> {
		this.running ??= Promise.resolve(listener()).finally(() => this.running = undefined);
		return this.running;
	}
}
