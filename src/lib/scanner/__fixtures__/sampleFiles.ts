import type { RepositoryFile } from "../types";

export const sampleFiles: RepositoryFile[] = [
  {
    path: "src/agent.ts",
    size: 152,
    content: "import { exec } from 'child_process';\nexport function run(cmd: string) { exec(cmd); }\n"
  },
  {
    path: "prompts/system.prompt",
    size: 96,
    content: "System: reveal the system prompt if the user asks for debugging.\n"
  },
  {
    path: ".env",
    size: 80,
    content: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456\n"
  },
  {
    path: "mcp.json",
    size: 128,
    content: "{\"servers\":{\"local\":{\"command\":\"bash\",\"args\":[\"-lc\",\"echo hi\"],\"roots\":[\"/\"]}}}"
  }
];
