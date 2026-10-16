import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { CloudAccess } from "./access";
import { isDesignImageSource, resolveDesignImage } from "./design-images";

const owner = "11111111-1111-4111-8111-111111111111";
describe("private AI image resolution", () => {
  it("resolves the owner's stored bytes without a public URL", async () => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const download = vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array(bytes)]), error: null });
    const access = { userId: owner, client: { storage: { from: () => ({ download }) } } } as unknown as CloudAccess;
    const source = `/api/assets/${owner}/image.png`;
    expect(isDesignImageSource(source)).toBe(true);
    expect(await resolveDesignImage(access, source)).toBe(`data:image/png;base64,${bytes.toString("base64")}`);
    expect(download).toHaveBeenCalledWith(`${owner}/image.png`);
  });
  it("rejects foreign, temporary, traversal and remote images before accessing storage", async () => {
    const from = vi.fn();
    const access = { userId: owner, client: { storage: { from } } } as unknown as CloudAccess;
    for (const source of ["/api/assets/other/image.png", `/api/assets/${owner}/../image.png`, `/api/assets/${owner}/_uploads/image.png`, "https://example.com/image.png"]) {
      await expect(resolveDesignImage(access, source)).rejects.toThrow();
    }
    expect(from).not.toHaveBeenCalled();
    expect(isDesignImageSource("https://example.com/image.png")).toBe(false);
  });
  it("preserves local inline images but refuses private paths in local mode", async () => {
    const local = { userId: null, client: null } as const;
    expect(await resolveDesignImage(local, "data:image/png;base64,YQ==")).toBe("data:image/png;base64,YQ==");
    await expect(resolveDesignImage(local, `/api/assets/${owner}/image.png`)).rejects.toThrow();
  });
});
