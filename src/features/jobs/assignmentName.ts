export function matchingAssignmentNames<T>(name: string, candidates: T[], getName: (candidate: T) => string): T[] {
  const normalized = name.trim().toLocaleLowerCase();
  return candidates.filter((candidate) => getName(candidate).trim().toLocaleLowerCase() === normalized);
}
