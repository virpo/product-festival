export async function runCommand<T>(
  action: () => Promise<T>,
  refresh: () => Promise<void>,
): Promise<T> {
  let result: T;

  try {
    result = await action();
  } catch (error) {
    try {
      await refresh();
    } catch {
      // Preserve the command error. The next connection retry can recover data.
    }
    throw error;
  }

  try {
    await refresh();
  } catch {
    // The write succeeded. Snapshot recovery owns the warning and retry.
  }

  return result;
}
