import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET as getProject, POST } from "./route";

const GET = () => getProject(new Request("http://localhost/api/project"));

let directory: string;
const bundle = (name = "Saved") => ({
  version: 1, activeId: "p1", order: ["p1"],
  projects: { p1: { appName: name, slidesByDevice: { iphone: [] } } },
});
const request = (body: unknown, revision?: string) => new Request("http://localhost/api/project", {
  method: "POST", headers: { "content-type": "application/json", ...(revision ? { "if-match": revision } : {}) },
  body: JSON.stringify(body),
});

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "appstore-project-test-"));
  vi.stubEnv("APP_STORE_PROJECT_FILE", path.join(directory, "projects.json"));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("project file safety", () => {
  it("rejects invalid data without overwriting saved projects", async () => {
    await POST(request(bundle()));
    for (const invalid of [null, [], { appName: "Wrong" }, { ...bundle(), order: ["missing"] }]) {
      expect((await POST(request(invalid))).status).toBe(400);
    }
    expect((await (await GET()).json()).state).toEqual(bundle());
  });
  it("serializes competing saves and rejects a stale revision", async () => {
    const initial = await (await POST(request(bundle()))).json();
    const responses = await Promise.all([
      POST(request(bundle("First edit"), initial.revision)),
      POST(request(bundle("Stale edit"), initial.revision)),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 409]);
    expect((await (await GET()).json()).state.projects.p1.appName).toBe("First edit");
    expect(JSON.parse(await readFile(path.join(directory, "projects.json"), "utf8"))).toEqual(bundle("First edit"));
  });
  it("reports a corrupted file without modifying it", async () => {
    await writeFile(path.join(directory, "projects.json"), "broken json");
    expect((await GET()).status).toBe(500);
    expect(await readFile(path.join(directory, "projects.json"), "utf8")).toBe("broken json");
  });
  it("preserves semantically invalid JSON rather than hydrating an empty workspace", async () => {
    for (const raw of ["null", "[]", '{"unrelated":"data"}']) {
      await writeFile(path.join(directory, "projects.json"), raw);
      expect((await GET()).status).toBe(500);
      expect(await readFile(path.join(directory, "projects.json"), "utf8")).toBe(raw);
    }
  });
  it("still reads a legacy single-project file", async () => {
    const legacy = { appName: "Legacy", slidesByDevice: { iphone: [] } };
    await writeFile(path.join(directory, "projects.json"), JSON.stringify(legacy));
    expect((await (await GET()).json()).state).toEqual(legacy);
  });
});
