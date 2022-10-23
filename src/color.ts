
let index = 0;

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

export function getNextColorId(): string {
	index = (index + 1) % colorIds.length;
	return colorIds[index];
}
