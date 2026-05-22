import { parse as parseVitest } from "./vitest";
import { parse as parseTsc } from "./tsc";
import { parse as parseEslint } from "./eslint";
import { parse as parsePytest } from "./pytest";
import { parse as parseMypy } from "./mypy";
import { parse as parseRuff } from "./ruff";
import type { ParseResult } from "./types";

export type ParserSet = {
  test: (output: string, exitCode: number) => ParseResult;
  type: (output: string, exitCode: number) => ParseResult;
  lint: (output: string, exitCode: number) => ParseResult;
};

export function selectParsers(ecosystem: "js" | "python" | null): ParserSet {
  if (ecosystem === "python") {
    return { test: parsePytest, type: parseMypy, lint: parseRuff };
  }
  return { test: parseVitest, type: parseTsc, lint: parseEslint };
}
