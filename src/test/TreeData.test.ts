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