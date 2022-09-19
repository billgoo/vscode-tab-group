import * as vscode from 'vscode';
import * as path from 'path';

type InputType = vscode.Tab["input"];
type KnownInputType = Exclude<InputType, unknown>;

type TypedTab<T extends InputType> = vscode.Tab & {
	input: T;
};

interface IInputHandler<T extends InputType> {
	readonly name: string;
	is(tab: vscode.Tab): tab is TypedTab<T>;
	getNormalizedId(tab: TypedTab<T>): string;
	createTreeItem(tab: TypedTab<T>): vscode.TreeItem;
	openEditor(tab: TypedTab<T>): Promise<void>;
}

const handlers: IInputHandler<KnownInputType>[] = [];

function getNormalizedIdForUnknownObject(input: Object): string {
	const getNormalizedObject = (object: any, depth: number = 2) => {
		const result: Record<string, any> = {};
		
		for (const key of Object.keys(object).sort()) {
			if (typeof object[key] === 'object' && !Array.isArray(object[key]) && object[key] !== null) {
				result[key] = depth > 0 ? getNormalizedObject(object[key], depth - 1) : object[key].toString();
			}
			result[key] = object[key];
		}

		return result;
	};

	return JSON.stringify(getNormalizedObject(input));
}

/**
 * This class is a default for logic safety.
 * Unknown-typed tab won't be added to the tree data, because we cannot find the way to find a unique id which can bind tree data and actual tab.  
 */
export class UnknownInputTypeHandler implements IInputHandler<unknown> {
	name = 'unknownInputType';
	is(tab: vscode.Tab): tab is TypedTab<unknown> {
		return true;
	}

	getNormalizedId(tab: TypedTab<unknown>) {
		if (typeof tab.input === 'object' && tab.input !== null) {
			return `${tab.label}:${getNormalizedIdForUnknownObject(tab.input)}`;
		}
		return `${tab.label}:${(tab.input as any).toString()}`;
	}

	createTreeItem(tab: TypedTab<unknown>) {
		return new vscode.TreeItem(tab.label);
	}

	openEditor(tab: TypedTab<unknown>): Promise<void> {
		return Promise.resolve();
	}
}

export const unknownInputTypeHandler = new UnknownInputTypeHandler();

export function getHandler(tab: vscode.Tab): IInputHandler<InputType> {
	for (const handler of handlers) {
		if (handler.is(tab)) {
			return handler;
		}
	}
	
	return unknownInputTypeHandler;
}

/**
 * Register handler
 * Note: The order matters! Place more specifc handler before the general one. e.g. `TabInputReadmePreviewHandler`, then `TabInputWebviewHandler`
 * @param ctor 
 */
function Registered(ctor: Function) {
	handlers.push(new (ctor as any)());
}

@Registered
export class TabInputTextHandler implements IInputHandler<vscode.TabInputText> {
	name = "TabInputText";

	is(tab: vscode.Tab): tab is TypedTab<vscode.TabInputText> {
		return tab.input instanceof vscode.TabInputText;
	}

	getNormalizedId(tab: TypedTab<vscode.TabInputText>): string {
		return tab.input.uri.toString();
	}

	createTreeItem(tab: TypedTab<vscode.TabInputText>): vscode.TreeItem {
		return new vscode.TreeItem(tab.input.uri);
	}

	async openEditor(tab: TypedTab<vscode.TabInputText>): Promise<void> {
		await vscode.window.showTextDocument(tab.input.uri);
		return;
	}
}

@Registered
export class TabInputTextDiffHandler implements IInputHandler<vscode.TabInputTextDiff> {
	name = "TabInputTextDiff";

	is(tab: vscode.Tab): tab is TypedTab<vscode.TabInputTextDiff> {
		return tab.input instanceof vscode.TabInputTextDiff;
	}

	getNormalizedId(tab: TypedTab<vscode.TabInputTextDiff>): string {
		return JSON.stringify({
			original: tab.input.original.toJSON(),
			modified: tab.input.modified.toJSON(),
		});
	}

	createTreeItem(tab: TypedTab<vscode.TabInputTextDiff>): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(tab.input.modified);
		treeItem.label = `${path.basename(tab.input.original.fsPath)}(${this.getGitRef(tab.input.original)}) ⟷ ${path.basename(tab.input.modified.fsPath)}(${this.getGitRef(tab.input.modified)})`;
		return treeItem;
	}

	async openEditor(tab: TypedTab<vscode.TabInputTextDiff>): Promise<void> {
		await vscode.commands.executeCommand("vscode.diff", tab.input.original, tab.input.modified, tab.label, { viewColumn: tab.group.viewColumn }).then(
			undefined,
			(e) => console.error(e)
		);
		return;
	}

	private getGitRef(uri: vscode.Uri): string {
		return JSON.parse(uri.query)["ref"] ?? "";
	}
}

@Registered
export class  TabInputCustomHandler implements IInputHandler<vscode.TabInputCustom> {
	name = "TabInputCustom";

	is(tab: vscode.Tab): tab is TypedTab<vscode.TabInputCustom> {
		return tab.input instanceof vscode.TabInputCustom;
	}
	
	getNormalizedId(tab: TypedTab<vscode.TabInputCustom>): string {
		return JSON.stringify({
			uri: tab.input.uri.toJSON(),
			viewType: tab.input.viewType,
		});
	}

	createTreeItem(tab: TypedTab<vscode.TabInputCustom>): vscode.TreeItem {
		return new vscode.TreeItem(tab.input.uri);
	}

	async openEditor(tab: TypedTab<vscode.TabInputCustom>): Promise<void> {
		await vscode.commands.executeCommand("vscode.openWith", tab.input.uri, tab.input.viewType, { viewColumn: tab.group.viewColumn });
		return;
	}
}

@Registered
export class TabInputWebviewHandler implements IInputHandler<vscode.TabInputWebview> {
	name = "TabInputWebview";

	is(tab: vscode.Tab): tab is TypedTab<vscode.TabInputWebview> {
		return tab.input instanceof vscode.TabInputWebview;
	}

	getNormalizedId(tab: TypedTab<vscode.TabInputWebview>): string {
		return tab.label;
	}

	createTreeItem(tab: TypedTab<vscode.TabInputWebview>): vscode.TreeItem {
		return new vscode.TreeItem(tab.label);
	}

	async openEditor(tab: TypedTab<vscode.TabInputWebview>): Promise<void> {
		return Promise.resolve();
	}
}
