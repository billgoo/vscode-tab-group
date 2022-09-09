import * as vscode from 'vscode';
let index = 0;

const colorIds = [
	"charts.foreground",
	"charts.lines",
	"charts.red",
	"charts.blue",
	"charts.yellow",
	"charts.orange",
	"charts.green",
	"charts.purple",
];

export const themeColors = colorIds.map(colorId => new vscode.ThemeColor(colorId));

export function getNextColorId(): string {
	index = (index + 1) % themeColors.length;
	return colorIds[index];
}
