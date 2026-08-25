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
    ];
  }

  dispose(): void {
    this.subscriptions.forEach(subscription => subscription.dispose());
    this._onDidChangeFileDecorations.dispose();

    if (tabFileDecorationProvider === this) {
      tabFileDecorationProvider = undefined;
    }
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const document = vscode.workspace.textDocuments.find(
      textDocument => textDocument.uri.toString() === uri.toString(),
    );
    if (document?.isDirty) {
      return {
        badge: '⦿',
        tooltip: 'Unsaved',
        color: new vscode.ThemeColor('charts.orange'),
        propagate: false,
      };
    }
    return undefined;
  }
}

let tabFileDecorationProvider: TabFileDecorationProvider | undefined;

export function getTabFileDecorationProvider(): TabFileDecorationProvider {
  tabFileDecorationProvider ??= new TabFileDecorationProvider();
  return tabFileDecorationProvider;
}

export function setTabDecoration(
  treeItem: vscode.TreeItem,
  uri: vscode.Uri,
  iconType: string = 'file',
): void {
  const decoration = getTabFileDecorationProvider().provideFileDecoration(uri);

  if (!decoration) {
    return;
  }

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
