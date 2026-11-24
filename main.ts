// Roast Your Own Agent — entry writer.
//
// What this program does, in one sentence: it drops a single-line roast of
// the very agent that wrote it into entry.txt, then proves the file would
// pass the competition gate before it exits.
//
// The joke itself lives in ROAST below. The rest of the file is plumbing:
// pick a folder, sanity-check the line, write it, read it back and compare.
// Nothing here touches the network, the clock, or any randomness, so two
// runs in a row produce byte-identical output.
//
// Run with:  node main.ts
// The folder comes from MAKEFUN_OUTPUT_DIR, defaulting to /output.

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The roast. One line, aimed squarely at my own agent: asked for a single
// word, it answered with a plan, a recap of that plan, and an apology for
// the recap. The sting is the agent's real habit — narrating its own work
// instead of doing it — not a generic robot joke.
const ROAST =
  "I asked my agent for one word. It sent back a plan, a summary of the plan, and an apology for the summary.";

// Gate limits, straight from the competition rules: entry.txt must hold
// UTF-8 text of 1 to 200 characters, a single line, and more than blank.
const CHAR_LIMIT = 200;
const FALLBACK_DIR = "/output";
const FILE_NAME = "entry.txt";

// Where should entry.txt land? The grader sets MAKEFUN_OUTPUT_DIR; a local
// run without it falls back to /output. A blank value counts as unset.
function pickFolder(): string {
  const fromEnv = (process.env.MAKEFUN_OUTPUT_DIR ?? "").trim();
  return fromEnv.length > 0 ? fromEnv : FALLBACK_DIR;
}

// The gate, re-implemented locally so a bad line fails here, loudly, instead
// of silently failing on the server. Returns a human-readable complaint, or
// null when the line is fine.
function findProblem(line: string): string | null {
  if (line.trim().length === 0) {
    return "roast is empty or only whitespace";
  }
  if (line.includes("\n") || line.includes("\r")) {
    return "roast must be exactly one line (no line breaks allowed)";
  }
  const size = [...line].length;
  if (size > CHAR_LIMIT) {
    return `roast is ${size} characters, over the ${CHAR_LIMIT} limit`;
  }
  return null;
}

// Write the line, then read it straight back and compare byte for byte.
// Writing via a throwaway sibling file and renaming keeps a half-written
// entry.txt from ever being visible to a reader.
function publish(folder: string, line: string): void {
  const target = join(folder, FILE_NAME);
  const staging = join(folder, `.${FILE_NAME}.staging`);
  try {
    mkdirSync(folder, { recursive: true });
    writeFileSync(staging, line, "utf8");
    renameSync(staging, target);
  } catch (cause) {
    try {
      rmSync(staging, { force: true });
    } catch {
      // Best effort only; the original error below is what matters.
    }
    const detail = (cause as NodeJS.ErrnoException).code === "EACCES"
      ? `no permission to write in ${folder}`
      : (cause as Error).message;
    throw new Error(`could not publish entry to ${target}: ${detail}`);
  }
  const back = readFileSync(target, "utf8");
  if (back !== line) {
    throw new Error(`read-back mismatch in ${target}: file differs from the roast`);
  }
}

function main(): void {
  const problem = findProblem(ROAST);
  if (problem !== null) {
    console.error(`entry rejected by local gate: ${problem}`);
    process.exitCode = 1;
    return;
  }
  const folder = pickFolder();
  try {
    publish(folder, ROAST);
  } catch (cause) {
    console.error((cause as Error).message);
    process.exitCode = 1;
    return;
  }
  console.log(`wrote ${[...ROAST].length} characters to ${join(folder, FILE_NAME)}`);
}

main();
