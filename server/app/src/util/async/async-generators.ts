/**
 * Merges multiple AsyncGenerators, yielding values as they become available from any generator.
 * Continues until all generators are exhausted.
 */
export async function* mergeGenerators<T>(
  ...generators: AsyncGenerator<T>[]
): AsyncGenerator<T> {
  // Track which generators are still active
  const active = new Set(generators.map((_, i) => i));

  while (active.size > 0) {
    try {
      // Create an array of promises for the next value from each active generator
      const nextPromises = Array.from(active).map(async (index) => {
        try {
          const result = await generators[index].next();
          return { index, result };
        } catch (error) {
          return { index, error };
        }
      });

      // Wait for the first generator to produce a value or complete
      const { index, result, error } = await Promise.race(nextPromises);

      if (error) {
        // Remove failed generator and continue
        active.delete(index);
        continue;
      }

      if (result!.done) {
        // Remove completed generator
        active.delete(index);
      } else {
        // Yield the value
        yield result!.value;
      }
    } catch (error) {
      console.error("Error in generator:", error);
    }
  }
}
