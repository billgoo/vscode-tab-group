
export function safeRemove<U, T extends U>(array: U[], item: T): void {
	const index = array.indexOf(item);
	if (index === -1) {
		return;
	}
	array.splice(index, 1);
}
