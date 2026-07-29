import { describe, expect, it, vi } from "vitest";
import { runCommand } from "./run-command";

describe("runCommand", () => {
  it("refreshes identity after a failed write and preserves the write error", async () => {
    const writeError = new Error("Session moved");
    const refresh = vi.fn().mockResolvedValue(undefined);

    await expect(
      runCommand(
        () => Promise.reject(writeError),
        refresh,
      ),
    ).rejects.toBe(writeError);

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("returns the action result after refreshing", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);

    await expect(
      runCommand(() => Promise.resolve("saved"), refresh),
    ).resolves.toBe("saved");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not report a successful write as failed when only refresh fails", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("Offline"));

    await expect(
      runCommand(() => Promise.resolve("saved"), refresh),
    ).resolves.toBe("saved");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
