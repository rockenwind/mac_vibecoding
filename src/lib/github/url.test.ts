import { describe, expect, it } from "vitest";
import { parseGitHubRepositoryUrl } from "./url";

describe("parseGitHubRepositoryUrl", () => {
  it("parses a canonical repository URL", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/openai/openai-node")).toEqual({
      owner: "openai",
      name: "openai-node",
      url: "https://github.com/openai/openai-node"
    });
  });

  it("normalizes a trailing slash and git suffix", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/openai/openai-node.git/")).toEqual({
      owner: "openai",
      name: "openai-node",
      url: "https://github.com/openai/openai-node"
    });
  });

  it("rejects unsupported hosts", () => {
    expect(() => parseGitHubRepositoryUrl("https://gitlab.com/openai/openai-node")).toThrow(
      "Only github.com repositories are supported."
    );
  });

  it("rejects invalid repository paths", () => {
    expect(() => parseGitHubRepositoryUrl("https://github.com/openai")).toThrow(
      "Enter a GitHub repository URL like https://github.com/owner/repo."
    );
  });
});
