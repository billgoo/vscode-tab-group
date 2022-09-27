

export function asPromise<T>(thenable: Thenable<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => thenable.then(resolve, reject));	
}