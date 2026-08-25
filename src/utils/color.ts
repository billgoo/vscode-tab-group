export type GroupColorId =
  | 'charts.blue'
  | 'charts.green'
  | 'charts.yellow'
  | 'charts.orange'
  | 'charts.red'
  | 'charts.purple';

export type GroupColorOption = {
  readonly id: GroupColorId;
  readonly label: string;
  readonly themeColorId: string;
  readonly swatch: string;
};

export const groupColorOptions: readonly GroupColorOption[] = [
  { id: 'charts.blue', label: 'Blue', themeColorId: 'terminal.ansiBrightBlue', swatch: '🔵' },
  { id: 'charts.green', label: 'Green', themeColorId: 'terminal.ansiBrightGreen', swatch: '🟢' },
  { id: 'charts.yellow', label: 'Yellow', themeColorId: 'terminal.ansiBrightYellow', swatch: '🟡' },
  { id: 'charts.orange', label: 'Orange', themeColorId: 'terminal.ansiYellow', swatch: '🟠' },
  { id: 'charts.red', label: 'Red', themeColorId: 'terminal.ansiBrightRed', swatch: '🔴' },
  {
    id: 'charts.purple',
    label: 'Purple',
    themeColorId: 'terminal.ansiBrightMagenta',
    swatch: '🟣',
  },
];

export function getGroupColorOption(colorId: string): GroupColorOption | undefined {
  return groupColorOptions.find(color => color.id === colorId);
}

export function getNextColorId(usedColorIds: string[] = []): GroupColorId {
  const colorIdsUseCount = groupColorOptions.map(
    color => usedColorIds.filter(usedColorId => usedColorId === color.id).length,
  );
  const smallestUseCount = Math.min(...colorIdsUseCount);
  const firstSmallestUseCountIndex = colorIdsUseCount.indexOf(smallestUseCount);
  return groupColorOptions[firstSmallestUseCountIndex].id;
}
