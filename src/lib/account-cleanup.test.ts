import { describe, expect, it, vi } from "vitest";
import { deleteAccountSchema, eraseAccount, type AccountCleanup } from "./account-cleanup";

const owner = "11111111-1111-4111-8111-111111111111";
function operations(): AccountCleanup {
  return { list: vi.fn(async () => []), remove: vi.fn(async () => {}), deleteVideos: vi.fn(async () => {}), deleteCredits: vi.fn(async () => {}), deleteIdentity: vi.fn(async () => {}) };
}
describe("account deletion", () => {
  it("requires explicit DELETE confirmation and rejects a supplied user ID", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "DELETE" }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirmation: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: "DELETE", userId: owner }).success).toBe(false);
  });
  it("deletes only the owner's files, nested files, rows, credits and identity", async () => {
    const ops = operations();
    ops.list = vi.fn(async (prefix) => prefix === owner
      ? [{ name: "film.mp4", id: "file" }, { name: "nested", id: null }]
      : [{ name: "poster.jpg", id: "poster" }]);
    await eraseAccount(owner, ops);
    expect(ops.remove).toHaveBeenCalledWith([`${owner}/nested/poster.jpg`]);
    expect(ops.remove).toHaveBeenCalledWith([`${owner}/film.mp4`]);
    expect(ops.deleteVideos).toHaveBeenCalledWith(owner);
    expect(ops.deleteCredits).toHaveBeenCalledWith(owner);
    expect(ops.deleteIdentity).toHaveBeenCalledWith(owner);
  });
  it("includes files beyond the first storage page", async () => {
    const ops = operations();
    ops.list = vi.fn(async (_prefix, offset) => offset === 0
      ? Array.from({ length: 100 }, (_, i) => ({ name: `${i}.mp4`, id: String(i) }))
      : [{ name: "last.mp4", id: "last" }]);
    await eraseAccount(owner, ops);
    expect(ops.list).toHaveBeenCalledWith(owner, 100);
    expect(ops.remove).toHaveBeenCalledWith([`${owner}/last.mp4`]);
  });
  it("retains the login identity when file removal fails so deletion can be retried", async () => {
    const ops = operations();
    ops.list = vi.fn(async () => [{ name: "film.mp4", id: "file" }]);
    ops.remove = vi.fn(async () => { throw new Error("Storage unavailable"); });
    await expect(eraseAccount(owner, ops)).rejects.toThrow("Storage unavailable");
    expect(ops.deleteIdentity).not.toHaveBeenCalled();
  });
  it("refuses paths escaping the authenticated owner's folder", async () => {
    const ops = operations();
    ops.list = vi.fn(async () => [{ name: "../other-user", id: "file" }]);
    await expect(eraseAccount(owner, ops)).rejects.toThrow("Invalid stored file path");
    expect(ops.remove).not.toHaveBeenCalled();
  });
});