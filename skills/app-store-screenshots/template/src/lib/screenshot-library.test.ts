import { describe, expect, it } from "vitest";
import { libraryScreenshots, thumbnailUrl } from "./screenshot-library";
import type { ProjectState, Slide } from "./types";

const owner = "325ac756-1567-4e74-b0ad-46a9cb35f6d6";
const asset = (name: string, who = owner) => `/api/assets/${who}/${name}.png`;
const project = (updatedAt: number, slides: Array<Partial<Slide>>) =>
  ({ updatedAt, slidesByDevice: { iphone: slides as Slide[] } }) as unknown as ProjectState;

describe("Your uploads", () => {
  it("lists each screenshot once, newest project first", () => {
    const projects = {
      old: project(1, [{ screenshot: asset("a") }, { screenshot: asset("b") }]),
      recent: project(2, [{ screenshot: asset("b") }, { screenshotSecondary: asset("c"), screenshotByLocale: { de: asset("d") } }]),
    };
    expect(libraryScreenshots(projects, owner)).toEqual([asset("b"), asset("c"), asset("d"), asset("a")]);
  });

  it("leaves out other accounts' files, staging uploads, data URLs and templated paths", () => {
    const projects = {
      p: project(1, [
        { screenshot: asset("x", "00000000-0000-0000-0000-000000000000") },
        { screenshot: `/api/assets/${owner}/_uploads/9f0c2b1e-0000-4000-8000-000000000000.png` },
        { screenshot: "data:image/png;base64,AAAA" },
        { screenshot: "/screenshots/localized/{locale}/one.png" },
        { screenshot: "" },
        { screenshot: asset("mine") },
      ]),
    };
    expect(libraryScreenshots(projects, owner)).toEqual([asset("mine")]);
  });

  it("uses files on disk in local mode", () => {
    const projects = { p: project(1, [{ screenshot: "/screenshots/uploaded/abc.png" }, { screenshot: asset("cloud") }]) };
    expect(libraryScreenshots(projects, null)).toEqual(["/screenshots/uploaded/abc.png"]);
  });

  it("asks the server for a small preview of private files only", () => {
    expect(thumbnailUrl(asset("a"))).toBe(`${asset("a")}?w=240`);
    expect(thumbnailUrl("/screenshots/uploaded/abc.png")).toBe("/screenshots/uploaded/abc.png");
  });
});
