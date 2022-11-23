import * as vscode from 'vscode';
import { asPromise } from './async';

export const enum ContextKeys {
	SortMode = 'tabGroup.sortMode:enabled',
	AllCollapsed = 'tabGroup.groups:allCollapsed',
};

const context: Record<string, any> = {};

export function getContext<T = any>(key: ContextKeys): T | undefined;
export function getContext<T = any>(key: ContextKeys, defaultValue: T): T;
export function getContext<T = any>(key: ContextKeys, defaultValue?: T): T | undefined {
	return context[key] ?? defaultValue;
}

export async function setContext(key: ContextKeys, value: unknown) {
	context[key] = value;
	return asPromise(vscode.commands.executeCommand('setContext', key, value));
}