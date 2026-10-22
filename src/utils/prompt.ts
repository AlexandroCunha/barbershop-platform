import { createInterface } from "node:readline";

/**
 * Reads one line from the terminal with the characters hidden. When the input is piped, the next
 * line is read as-is, so the command can be scripted.
 */
export function askHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return readPipedLine();
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (result: () => void) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      result();
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") {
          finish(() => resolve(value));
          return;
        }
        if (character === "\u0003") {
          finish(() => reject(new Error("Cancelled. Nothing was saved.")));
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

/** One reader for the whole run, so lines that arrive together are not lost between questions. */
let pipedLines: AsyncIterator<string> | undefined;

async function readPipedLine(): Promise<string> {
  pipedLines ??= createInterface({ input: process.stdin })[Symbol.asyncIterator]();
  const next = await pipedLines.next();
  if (next.done) {
    throw new Error("No password was provided. Nothing was saved.");
  }
  return next.value;
}
