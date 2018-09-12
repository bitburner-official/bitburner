export const orderBy = <T>(
  array: ReadonlyArray<T>,
  prop: keyof T | ((item: T) => any),
  asc: boolean = true,
): Array<T> => {
  const accessor = typeof prop === 'function' ? prop : (item: T) => item[prop];
  const copy = [...array];
  copy.sort((a, b) => {
    const aVal = accessor(a);
    const bVal = accessor(b);
    if (aVal < bVal) return asc ? -1 : 1;
    if (bVal < aVal) return asc ? 1 : -1;
    return 0;
  });

  return copy;
};
