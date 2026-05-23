import type { JudgeConfig } from "../types";

export interface JudgeProvider {
  complete(prompt: string): Promise<string>;
  readonly modelId: string;
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

export class AnthropicProvider implements JudgeProvider {
  readonly modelId: string;

  constructor(private readonly config: JudgeConfig) {
    this.modelId = config.model;
  }

  async complete(prompt: string): Promise<string> {
    const key = process.env["ANTHROPIC_API_KEY"];
    if (!key) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is not set. " +
          "Export it before running: export ANTHROPIC_API_KEY=sk-ant-..."
      );
    }

    // Loaded lazily so the SDK does not inflate startup for non-Anthropic providers.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: Anthropic } = require("@anthropic-ai/sdk") as {
      default: typeof import("@anthropic-ai/sdk").default;
    };

    const client = new Anthropic({ apiKey: key });
    const message = await client.messages.create({
      model: this.modelId,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      throw new Error("AnthropicProvider: received non-text response block");
    }
    return block.text;
  }
}

// ─── Local (OpenAI-compatible) ────────────────────────────────────────────────

export class LocalProvider implements JudgeProvider {
  readonly modelId: string;
  private readonly baseURL: string;

  constructor(config: JudgeConfig) {
    this.modelId = config.model;
    if (!config.baseURL) {
      throw new Error(
        "LocalProvider requires judge.baseURL in config (e.g. http://localhost:11434)"
      );
    }
    this.baseURL = config.baseURL.replace(/\/$/, "");
  }

  async complete(prompt: string): Promise<string> {
    const url = `${this.baseURL}/v1/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelId,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      throw new Error(`LocalProvider: HTTP ${res.status} from ${url}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const choices = data["choices"] as
      | Array<{ message: { content: string } }>
      | undefined;
    const content = choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("LocalProvider: empty or malformed response from endpoint");
    }
    return content;
  }
}

// ─── Mock (deterministic, for tests and offline calibration) ──────────────────

export class MockProvider implements JudgeProvider {
  readonly modelId = "mock";
  callCount = 0;

  async complete(prompt: string): Promise<string> {
    this.callCount++;
    const dims: Array<{
      dimension: string;
      score: number;
      confidence: number;
      rationale: string;
    }> = [
      {
        dimension: "readability",
        score: 72,
        confidence: 0.8,
        rationale: "Code is generally clear with consistent naming conventions.",
      },
      {
        dimension: "scope_discipline",
        score: 78,
        confidence: 0.75,
        rationale: "Change stays focused with minor tangential touches.",
      },
    ];

    // Reflect task_match only if the prompt requested it.
    if (prompt.includes("task_match")) {
      dims.push({
        dimension: "task_match",
        score: 82,
        confidence: 0.7,
        rationale: "Diff implements the stated task with reasonable completeness.",
      });
    }

    return JSON.stringify(dims);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function selectProvider(config: JudgeConfig): JudgeProvider | null {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "local":
      return new LocalProvider(config);
    case "mock":
      return new MockProvider();
    case "none":
      return null;
    default: {
      const _exhaustive: never = config.provider;
      void _exhaustive;
      return null;
    }
  }
}
