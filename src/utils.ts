import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { File, Folder, TreeItemType } from './types';

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
        id: randomUUID(),
        label: file,
        filePath,
        collapsed: true,
        children: getFilePathTree(filePath),  // Recursively get file path tree for subdirectory
      })
    } else {
      filePathTree.push({
        type: 0,
        id: randomUUID(),
        label: file,
        filePath
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

export function asPromise<T>(thenable: Thenable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => thenable.then(resolve, reject));
}

export function updateIds(element: File | Folder) {
  const localElement = {...element};
  
  localElement.id = randomUUID();
  if (localElement.type === TreeItemType.Folder && localElement.children.length) {
    localElement.children = localElement.children.map(element => updateIds(element));
  }
  
  return localElement;
}

export function deleteInRootById(elements: Array<File | Folder>, id: string): (File | Folder)[] | null {
	// Iterate over each element in the array
	for (let i = 0; i < elements.length; i++) {
		const element = elements[i];
    if (!element) continue;

		// Check if the current element has the desired ID
    if (element.id === id) {
      return elements.splice(i, 1); // Delete element with the matching ID
  }
	
		// Check if the current element has children
		if (element.type === TreeItemType.Folder && element.children?.length > 0) {
		// Recursively search for the ID in the children array
		const foundElement = deleteInRootById(element.children, id);
		
		// Check if element was successfully deleted
		if (foundElement) {
			return foundElement; // Return deletion result
		}
		}
	}
	
	// If no element is found with the given ID, return null
	return null;
}

  export function sortByName(a: File | Folder, b: File | Folder) {
      // Convert both names to lowercase for case-insensitive sorting
      const labelA = a.label.toLowerCase();
      const labelB = b.label.toLowerCase();
    
      // Folders always on top of Files
      if (a.type === TreeItemType.File && b.type === TreeItemType.Folder) {
        return 1;
      }
      if (a.type === TreeItemType.Folder && b.type === TreeItemType.File) {
        return -1;
      }

      if (labelA < labelB) {
        return -1; // The first name comes before the second name (in alphabetical order)
      }
    
      if (labelA > labelB) {
        return 1; // The first name comes after the second name (in alphabetical order)
      }
    
      return 0; // The names are equal
  }
