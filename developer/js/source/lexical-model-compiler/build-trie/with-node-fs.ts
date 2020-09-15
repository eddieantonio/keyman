import { readFileSync } from "fs";
import { detectEncoding, enumerateLines, NEWLINE_SEPARATOR } from "./index";

export class WordListFromFilename {
  readonly name: string;
  constructor(filename: string) {
    this.name = filename;
  }

  *lines() {
    let contents = readFileSync(this.name, detectEncoding(this.name));
    yield* enumerateLines(contents.split(NEWLINE_SEPARATOR));
  }
}
