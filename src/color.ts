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

export function getNextColorId(usedColorIds: string[] = []): string {
	const colorIdsUseCount = colorIds.map(colorId => usedColorIds.filter(usedColorId => usedColorId === colorId).length);
	const smallestUseCount = Math.min(...colorIdsUseCount);
	const firstSmallestUseCountIndex = colorIdsUseCount.indexOf(smallestUseCount);
	return colorIds[firstSmallestUseCountIndex];
}
