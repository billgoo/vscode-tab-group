import * as vscode from 'vscode';

export class TabFileDecorationProvider implements vscode.FileDecorationProvider {
    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri[]>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    constructor() {
        // Listen to document changes to update decorations
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.isDirty) {
                this._onDidChangeFileDecorations.fire([e.document.uri]);
            } else {
                // When saved, remove decoration
                this._onDidChangeFileDecorations.fire([e.document.uri]);
            }
        });

        // Also listen to tab changes to refresh decorations
        vscode.window.tabGroups.onDidChangeTabs(() => {
            // Refresh all decorations
            this._onDidChangeFileDecorations.fire([]);
        });
    }

    provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
        // Check if the document is dirty (modified but not saved)
        const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
        if (document && document.isDirty) {
            return {
                badge: '⦿', // A dot to indicate modified
                tooltip: 'Unsaved',
                color: new vscode.ThemeColor('charts.orange'),
                propagate: false
            };
        }
        return undefined;
    }
}

// Export a global instance for manual access
export const tabFileDecorationProvider = new TabFileDecorationProvider();

// Helper function to apply decoration to a TreeItem
export function setTabDecoration(treeItem: vscode.TreeItem, uri: vscode.Uri, iconType: string = 'file'): void {
    const decoration = tabFileDecorationProvider.provideFileDecoration(uri) as vscode.FileDecoration | undefined;

    if (decoration) {
        if (decoration.badge && treeItem.label) {
            treeItem.label = `${decoration.badge} ${treeItem.label}`;
        }
        if (decoration.tooltip) {
            treeItem.tooltip = decoration.tooltip;
        }
        if (decoration.color) {
            treeItem.iconPath = new vscode.ThemeIcon(iconType, decoration.color);
        }
    }
}