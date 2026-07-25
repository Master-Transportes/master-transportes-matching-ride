export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number; baseDelay?: number },
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const baseDelay = options?.baseDelay ?? 300;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
    }
  }

  throw new Error("unreachable");
}
