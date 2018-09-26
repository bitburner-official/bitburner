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

export const findLast = <T>(
  array: ReadonlyArray<T>,
  fn: (item: T) => boolean,
): T => {
  if (array.length === 0) {
    throw new Error(`Array was empty`);
  }

  for (let i = 1; i < array.length; i++) {
    if (!fn(array[i])) {
      return array[i - 1];
    }
  }

  return array[array.length - 1];
};

export const without = <T>(
  array: ReadonlyArray<T>,
  item: T,
): ReadonlyArray<T> => array.filter(i => i !== item);
