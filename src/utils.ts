import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as vscode from 'vscode';

const ignoredFiles = ["node_modules", 'src'];

export function getFilePathTree(dir: string): any {
  const files = fs.readdirSync(dir);
  let filePathTree: any = [];

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory() && !ignoredFiles.includes(file)) {
      filePathTree.push({
		type: 1,
		collapsed: true,
		colorId: 'charts.lines',
		id: randomUUID(),
		label: file,
		groupId: file,
		children: getFilePathTree(filePath),  // Recursively get file path tree for subdirectory
	   })
    } else {
      filePathTree.push({
		type: 0,
		groupId: null,
		label: file,
		id: filePath,
	   })
    }
  });

  return filePathTree;
}


export async function openFileByPath(filePath: string): Promise<void> {
    try {
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);
    } catch (error) {
        console.error(`Failed to open file ${filePath}:`, error);
    }
}
