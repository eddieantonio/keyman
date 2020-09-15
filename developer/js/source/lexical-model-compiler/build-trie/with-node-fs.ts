import { readFileSync } from "fs";
import { detectEncodingFromBuffer, enumerateLines, NEWLINE_SEPARATOR } from "./index";

export class WordListFromFilename {
  readonly name: string;
  constructor(filename: string) {
    this.name = filename;
  }

  *lines() {
    let contents = readFileSync(this.name, detectEncodingFromFilename(this.name));
    yield* enumerateLines(contents.split(NEWLINE_SEPARATOR));
  }
}

export function detectEncodingFromFilename(filename: string): 'utf8' | 'utf16le' {
  let buffer = readFileSync(filename);
  return detectEncodingFromBuffer(buffer);
}