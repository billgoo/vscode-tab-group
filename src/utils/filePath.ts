export function findLongestCommonFilePathPrefixIndex(
  filePathArrays: ReadonlyArray<ReadonlyArray<string>>,
): number {
  if (filePathArrays.length === 0) {
    return -1;
  }

  const minLength = Math.min(...filePathArrays.map(filePathArray => filePathArray.length));

  for (let index = 0; index < minLength; index++) {
    const segment = filePathArrays[0][index];
    if (filePathArrays.some(filePathArray => filePathArray[index] !== segment)) {
      return index - 1;
    }
  }

  return minLength - 1;
}
