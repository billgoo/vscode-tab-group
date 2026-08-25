import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Tab Group extension', () => {
  test('activates and registers its tab-group commands', async () => {
    const extension = vscode.extensions.getExtension('jiapeiyao.tab-group');

    assert.ok(extension, 'The Tab Group extension should be available to the extension host.');
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('tabsTreeView.tab.ungroup'));
    assert.ok(commands.includes('tabsTreeView.group.rename'));
    assert.ok(commands.includes('tabsTreeView.enableSortMode'));
    assert.ok(commands.includes('tabsTreeView.reset'));
  });
});
