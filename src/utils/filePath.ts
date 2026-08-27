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

export function getFilePathDescription(
  filePath: ReadonlyArray<string>,
  relatedFilePaths: ReadonlyArray<ReadonlyArray<string>>,
): string | undefined {
  if (relatedFilePaths.length < 2) {
    return undefined;
  }

  const commonPrefixIndex = findLongestCommonFilePathPrefixIndex(relatedFilePaths);
  const description = filePath.slice(commonPrefixIndex + 1, -1);
  return description.length > 0 ? description.join('/') : undefined;
}
