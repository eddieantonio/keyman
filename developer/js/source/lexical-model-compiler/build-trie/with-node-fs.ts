/**
 * Extends build-trie with utilities that depend upon Node's fs module.
 * 
 * @file with-node-fs
 */
import { readFileSync } from "fs";
import { compileTrieFromWordlist, detectEncodingFromBuffer, enumerateLines, NEWLINE_SEPARATOR, WordList, _parseWordList } from "./index";

/**
 * Returns a data structure that can be loaded by the TrieModel.
 *
 * It implements a **weighted** trie, whose indices (paths down the trie) are
 * generated by a search key, and not concrete wordforms themselves.
 *
 * @param sourceFiles an array of source files that will be read to generate the trie.
 */
export function createTrieDataStructureFromFilenames(filenames: string[], searchTermToKey: (wf: string) => string): string {
  return compileTrieFromWordlist(wordListFromFilenames(filenames), searchTermToKey);
}

/**
 * @deprecated
 * @param filenames a list of filenames to open
 * @param searchTermToKey the key function
 */
export function createTrieDataStructure(filenames: string[], searchTermToKey?: (wf: string) => string): string {
  if (typeof searchTermToKey !== "function") {
    // TODO: why is this a type error and not a static error???
    throw new TypeError("searchTermToKey must be explicitly specified")
  }

  let wordlist: WordList = wordListFromFilenames(filenames);
  return compileTrieFromWordlist(wordlist, searchTermToKey);
}

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


/**
 * Make one big word list out of all of the filenames provided.
 */
export function wordListFromFilenames(filenames: string[]) {
  let wordlist: WordList = {};
  filenames.forEach(filename => parseWordListFromFilename(wordlist, filename));
  return wordlist;
}

/**
 * Parses a word list from a file, merging duplicate entries.
 *
 * The word list may be encoded in:
 *
 *  - UTF-8, with or without BOM [exported by most software]
 *  - UTF-16, little endian, with BOM [exported by Microsoft Excel]
 *
 * @param wordlist word list to merge entries into (may have existing entries)
 * @param filename filename of the word list
 */
export function parseWordListFromFilename(wordlist: WordList, filename: string): void {
  _parseWordList(wordlist, new WordListFromFilename(filename));
}