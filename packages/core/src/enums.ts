export type EnumValue<T extends Record<string, string | number>> = T[keyof T];

export function defineEnum<const T extends Record<string, number>>(values: T): Readonly<T> {
  return Object.freeze(values);
}

export function defineStringEnum<const T extends Record<string, string>>(values: T): Readonly<T> {
  return Object.freeze(values);
}
