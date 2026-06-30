import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRepositoryFiles } from "./source";

describe("fetchRepositoryFiles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("encodes repository, branch, and file path segments in GitHub URLs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ default_branch: "feature/space branch" }))
      .mockResolvedValueOnce(
        jsonResponse({
          tree: [
            {
              path: "src/file name#1.ts",
              type: "blob",
              size: 12,
              url: "https://api.github.com/blob"
            }
          ]
        })
      )
      .mockResolvedValueOnce(textResponse("const ok = true;"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRepositoryFiles({
      owner: "example",
      name: "repo name",
      url: "https://github.com/example/repo name"
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/example/repo%20name",
      { headers: { Accept: "application/vnd.github+json" } }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/example/repo%20name/git/trees/feature%2Fspace%20branch?recursive=1",
      { headers: { Accept: "application/vnd.github+json" } }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://raw.githubusercontent.com/example/repo%20name/feature%2Fspace%20branch/src/file%20name%231.ts"
    );
  });

  it("maps tree rate limits to the standard GitHub rate limit error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchRepositoryFiles({
        owner: "example",
        name: "repo",
        url: "https://github.com/example/repo"
      })
    ).rejects.toThrow("GitHub rate limit reached. Try again later.");
  });

  it("warns when more than 200 matching files are available", async () => {
    const tree = Array.from({ length: 201 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      type: "blob",
      size: 12,
      url: "https://api.github.com/blob"
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(jsonResponse({ tree }));

    for (let index = 0; index < 200; index += 1) {
      fetchMock.mockResolvedValueOnce(textResponse("const ok = true;"));
    }

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRepositoryFiles({
      owner: "example",
      name: "repo",
      url: "https://github.com/example/repo"
    });

    expect(result.files).toHaveLength(200);
    expect(result.warnings).toContainEqual({
      message: "Only the first 200 matching files were scanned."
    });
  });
});

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

function textResponse(body: string): Response {
  return new Response(body);
}
