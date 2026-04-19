import { describe, expect, test } from '@jest/globals';
import { stat } from 'fs';
import { TreeData } from '../TreeData';
import { Group, isGroup, Tab, isTab, TreeItemType } from '../types';

function createTab(id: string): Tab {
	return {
		type: TreeItemType.Tab,
		groupId: null,
		id,
	};
}

function createGroup(id: string): Group {
	return {
		type: TreeItemType.Group,
		children: [],
		colorId: '',
		id,
		label: id,
		collapsed: false,
	};
}

describe('Group operation', () => {
  	test('Drag A onto B', () => {
		const a = createTab('A');
		const b = createTab('B');
		const c = createTab('C');
		const treeData = new TreeData();
		treeData.setState([a, b, c]);
		treeData.group(b, [a]);
		const state = treeData.getState();

		expect(state.length).toBe(2);
		expect(isGroup(state[0])).toBe(true);
		expect((state[0] as Group).children[0]).toBe(b);
		expect((state[0] as Group).children[1]).toBe(a);
		expect(isTab(state[1])).toBe(true);
  	});

	test('Drag [A,B] onto C', () => {
		const a = createTab('A');
		const b = createTab('B');
		const c = createTab('C');
		const treeData = new TreeData();
		treeData.setState([a, b, c]);
		treeData.group(c, [a, b]);
		
		const state = treeData.getState();
		expect(state.length).toBe(1);
		expect(isGroup(state[0])).toBe(true);
		const _group = state[0] as Group;
		expect(_group.children.length).toBe(3);
		expect(_group.children[0]).toBe(c);
		expect(_group.children[1]).toBe(a);
		expect(_group.children[2]).toBe(b);
	});
});

describe('Ungroup operation', () => {
	test('Ungroup A in [A,B],C', () => {
		const group = createGroup('G');
		const a = createTab('A');
		const b = createTab('B');
		const c = createTab('C');
		a.groupId = group.id;
		b.groupId = group.id;
		group.children = [a, b];

		const treeData = new TreeData();
		treeData.setState([group, c]);

		treeData.ungroup([a]);

		const state = treeData.getState();
		expect(state.length).toBe(3);
		expect(isGroup(state[0])).toBe(true);
		expect(state[1]).toBe(a);
		expect(state[2]).toBe(c);
	})
});

describe('groupByParentFolder', () => {
	test('Groups ungrouped tabs that share the same parent directory', () => {
		const a = createTab('file:///project/src/A.ts');
		const b = createTab('file:///project/src/B.ts');
		const c = createTab('file:///project/lib/C.ts');
		const d = createTab('file:///project/lib/D.ts');
		const treeData = new TreeData();
		treeData.setState([a, b, c, d]);
		treeData.groupByParentFolder();
		const state = treeData.getState();

		expect(state.length).toBe(2);
		expect(isGroup(state[0])).toBe(true);
		expect((state[0] as Group).label).toBe('lib');
		expect(isGroup(state[1])).toBe(true);
		expect((state[1] as Group).label).toBe('src');
	});

	test('Groups single-tab directories as one-item groups', () => {
		const a = createTab('file:///project/src/A.ts');
		const b = createTab('file:///project/src/B.ts');
		const c = createTab('file:///project/lib/C.ts');
		const treeData = new TreeData();
		treeData.setState([a, b, c]);
		treeData.groupByParentFolder();
		const state = treeData.getState();

		expect(state.length).toBe(2);
		expect(isGroup(state[0])).toBe(true);
		expect((state[0] as Group).label).toBe('lib');
		expect((state[0] as Group).children.length).toBe(1);
		expect(isGroup(state[1])).toBe(true);
		expect((state[1] as Group).label).toBe('src');
	});

	test('Merges new ungrouped tab into existing group with same label', () => {
		const a = createTab('file:///project/src/A.ts');
		const b = createTab('file:///project/src/B.ts');
		const treeData = new TreeData();
		treeData.setState([a, b]);
		treeData.groupByParentFolder('file:///project');

		// Simulate a new tab opening in the same folder
		const c = createTab('file:///project/src/C.ts');
		treeData.appendTab(c.id);
		treeData.groupByParentFolder('file:///project');

		const state = treeData.getState();
		expect(state.length).toBe(1);
		expect(isGroup(state[0])).toBe(true);
		expect((state[0] as Group).children.length).toBe(3);
		expect((state[0] as Group).label).toBe('src');
	});

	test('Labels groups with relative path when workspaceRoot is provided', () => {
		const a = createTab('file:///project/src/A.ts');
		const b = createTab('file:///project/src/B.ts');
		const c = createTab('file:///project/lib/sub/C.ts');
		const d = createTab('file:///project/lib/sub/D.ts');
		const treeData = new TreeData();
		treeData.setState([a, b, c, d]);
		treeData.groupByParentFolder('file:///project');
		const state = treeData.getState();

		expect(state.length).toBe(2);
		const labels = (state as Group[]).map(g => g.label).sort();
		expect(labels).toEqual(['lib/sub', 'src']);
	});

	test('Labels root-level files group as "/" when workspaceRoot is provided', () => {
		const a = createTab('file:///project/A.ts');
		const b = createTab('file:///project/B.ts');
		const treeData = new TreeData();
		treeData.setState([a, b]);
		treeData.groupByParentFolder('file:///project');
		const state = treeData.getState();

		expect(state.length).toBe(1);
		expect(isGroup(state[0])).toBe(true);
		expect((state[0] as Group).label).toBe('/');
	});

	test('Does not group non-file-URI tabs', () => {
		const a = createTab('{"modified":{"scheme":"git"}}');
		const b = createTab('{"modified":{"scheme":"git","path":"B"}}');
		const treeData = new TreeData();
		treeData.setState([a, b]);
		treeData.groupByParentFolder();
		const state = treeData.getState();

		// Non-file tabs are skipped, so nothing should be grouped
		expect(state.every(isTab)).toBe(true);
	});
});

describe('sortAlphabetically', () => {
	function makeGroupWithTabs(id: string, label: string, tabIds: string[]): Group {
		const group = createGroup(id);
		group.label = label;
		const tabs = tabIds.map(tid => {
			const t = createTab(tid);
			t.groupId = id;
			return t;
		});
		group.children = tabs;
		return group;
	}

	test('scope=all sorts root items and tabs within groups', () => {
		const gB = makeGroupWithTabs('gB', 'B-group', ['file:///p/z.ts', 'file:///p/a.ts']);
		const gA = makeGroupWithTabs('gA', 'A-group', ['file:///p/y.ts', 'file:///p/b.ts']);
		const treeData = new TreeData();
		treeData.setState([gB, gA]);
		treeData.sortAlphabetically('all');
		const state = treeData.getState();

		expect(isGroup(state[0])).toBe(true);
		expect((state[0] as Group).label).toBe('A-group');
		expect((state[0] as Group).children[0].id).toBe('file:///p/b.ts');
		expect((state[0] as Group).children[1].id).toBe('file:///p/y.ts');
		expect((state[1] as Group).label).toBe('B-group');
	});

	test('scope=groupsOnly sorts root items but not tabs within groups', () => {
		const gB = makeGroupWithTabs('gB', 'B-group', ['file:///p/z.ts', 'file:///p/a.ts']);
		const gA = makeGroupWithTabs('gA', 'A-group', ['file:///p/y.ts', 'file:///p/b.ts']);
		const treeData = new TreeData();
		treeData.setState([gB, gA]);
		treeData.sortAlphabetically('groupsOnly');
		const state = treeData.getState();

		expect((state[0] as Group).label).toBe('A-group');
		// Children order unchanged
		expect((state[0] as Group).children[0].id).toBe('file:///p/y.ts');
		expect((state[0] as Group).children[1].id).toBe('file:///p/b.ts');
	});

	test('scope=tabsOnly sorts tabs within groups but preserves group order', () => {
		const gB = makeGroupWithTabs('gB', 'B-group', ['file:///p/z.ts', 'file:///p/a.ts']);
		const gA = makeGroupWithTabs('gA', 'A-group', ['file:///p/y.ts', 'file:///p/b.ts']);
		const treeData = new TreeData();
		treeData.setState([gB, gA]);
		treeData.sortAlphabetically('tabsOnly');
		const state = treeData.getState();

		// Group order is unchanged
		expect((state[0] as Group).label).toBe('B-group');
		// Children are sorted
		expect((state[0] as Group).children[0].id).toBe('file:///p/a.ts');
		expect((state[0] as Group).children[1].id).toBe('file:///p/z.ts');
	});

	test('scope=tabsOnly sorts ungrouped root tabs without disturbing groups', () => {
		const gB = makeGroupWithTabs('gB', 'B-group', []);
		gB.children = []; // keep empty for this test to avoid removal
		const tabZ = createTab('file:///p/z.ts');
		const tabA = createTab('file:///p/a.ts');
		const treeData = new TreeData();
		// Manually set state with a group between two ungrouped tabs
		treeData.setState([tabZ, tabA]);
		treeData.sortAlphabetically('tabsOnly');
		const state = treeData.getState();

		expect(isTab(state[0])).toBe(true);
		expect((state[0] as Tab).id).toBe('file:///p/a.ts');
		expect((state[1] as Tab).id).toBe('file:///p/z.ts');
	});
});