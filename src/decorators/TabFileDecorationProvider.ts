import * as vscode from 'vscode';

export class TabFileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri[]>();
  private readonly subscriptions: vscode.Disposable[];
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor() {
    this.subscriptions = [
      vscode.workspace.onDidChangeTextDocument(e => {
        this._onDidChangeFileDecorations.fire([e.document.uri]);
      }),
      vscode.window.tabGroups.onDidChangeTabs(() => {
        this._onDidChangeFileDecorations.fire([]);
      }),
    ];
  }

  dispose(): void {
    this.subscriptions.forEach(subscription => subscription.dispose());
    this._onDidChangeFileDecorations.dispose();

    if (_tabFileDecorationProvider === this) {
      _tabFileDecorationProvider = undefined;
    }
  }

  provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
    // Check if the document is dirty (modified but not saved)
    const document = vscode.workspace.textDocuments.find(
      doc => doc.uri.toString() === uri.toString(),
    );
    if (document && document.isDirty) {
      return {
        badge: '⦿', // A dot to indicate modified
        tooltip: 'Unsaved',
        color: new vscode.ThemeColor('charts.orange'),
        propagate: false,
      };
    }
    return undefined;
  }
}

// Lazy-initialized global instance
let _tabFileDecorationProvider: TabFileDecorationProvider | undefined;
export function getTabFileDecorationProvider(): TabFileDecorationProvider {
  if (!_tabFileDecorationProvider) {
    _tabFileDecorationProvider = new TabFileDecorationProvider();
  }
  return _tabFileDecorationProvider;
}

// Backward compatibility export
Object.defineProperty(module.exports, 'tabFileDecorationProvider', {
  get() {
    return getTabFileDecorationProvider();
  },
});

// Helper function to apply decoration to a TreeItem
export function setTabDecoration(
  treeItem: vscode.TreeItem,
  uri: vscode.Uri,
  iconType: string = 'file',
): void {
  const provider = getTabFileDecorationProvider();
  const decoration = provider.provideFileDecoration(uri) as vscode.FileDecoration | undefined;

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
