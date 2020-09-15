import { log, KeymanCompilerError } from "../../errors";
import { WordListFromFilename } from "./with-node-fs";

// Supports LF or CRLF line terminators.
export const NEWLINE_SEPARATOR = /\u000d?\u000a/;

/**
 * A word list is (conceptually) an array of pairs: the concrete word form itself + a
 * non-negative count.
 *
 * Since each word should only appear once within the list, we represent it with
 * an associative array pattern keyed by the wordform.
 */
export type WordList = {[wordform: string]: number};

/**
 * Returns a data structure that can be loaded by the TrieModel.
 *
 * It implements a **weighted** trie, whose indices (paths down the trie) are
 * generated by a search key, and not concrete wordforms themselves.
 *
 * @param sourceFiles an array of source files that will be read to generate the trie.
 */
export function createTrieDataStructure(filenames: string[], searchTermToKey?: (wf: string) => string): string {
  if (typeof searchTermToKey !== "function") {
    throw new TypeError("searchTermToKey must be explicitly specified")
  }
  // Make one big word list out of all of the filenames provided.
  let wordlist: WordList = {};
  filenames.forEach(filename => parseWordListFromFilename(wordlist, filename));

  let trie = Trie.buildTrie(wordlist, searchTermToKey as Trie.SearchTermToKey);
  return JSON.stringify(trie);
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

/**
 * Parses a word list from a string. The string should have multiple lines
 * with LF or CRLF line terminators.
 *
 * @param wordlist word list to merge entries into (may have existing entries)
 * @param filename filename of the word list
 */
export function parseWordListFromContents(wordlist: WordList, contents: string): void {
  _parseWordList(wordlist, new WordListFromMemory(contents));
}

/**
 * Reads a tab-separated values file into a word list. This function converts all
 * entries into NFC and merges duplicate entries across wordlists. Duplication is
 * on the basis of character-for-character equality after normalisation to NFC.
 *
 * Format specification:
 *
 *  - the file is a UTF-8 encoded text file.
 *  - new lines are either LF or CRLF.
 *  - the file MAY start with the UTF-8 byte-order mark (BOM); that is, if the
 *    first three bytes of the file are EF BB BF, these will be interepreted as
 *    the BOM and will be ignored.
 *  - the file either consists of a comment or an entry.
 *  - comment lines MUST start with the '#' character on the very first column.
 *  - entries are one to three columns, separated by the (horizontal) tab
 *    character.
 *  - column 1 (REQUIRED): the wordform: can have any character except tab, CR,
 *    LF. Surrounding whitespace characters are trimmed.
 *  - column 2 (optional): the count: a non-negative integer specifying how many
 *    times this entry has appeared in the corpus. Blank means 'indeterminate'.
 *  - column 3 (optional): comment: an informative comment, ignored by the tool.
 *
 * @param wordlist word list to merge entries into (may have existing entries)
 * @param contents contents of the file to import
 */
function _parseWordList(wordlist: WordList, source:  WordListSource): void {
  const TAB = "\t";

  let wordsSeenInThisFile = new Set<string>();

  for (let [lineno, line] of source.lines()) {
    // Remove the byte-order mark (BOM) from the beginning of the string.
    // Because `contents` can be the concatenation of several files, we have to remove
    // the BOM from every possible start of file -- i.e., beginning of every line.
    line = line.replace(/^\uFEFF/, '').trim();

    if (line.startsWith('#') || line === "") {
      continue; // skip comments and empty lines
    }

    // The third column is the comment. Always ignored!
    let [wordform, countText] = line.split(TAB);

    // Clean the word form.
    let original = wordform;

    wordform = wordform.normalize('NFC');
    if (original !== wordform) {
      // Mixed normalization forms are yucky! Warn about it.
      log(
        KeymanCompilerError.CWARN_MixedNormalizationForms,
        `“${wordform}” is not in Unicode NFC. Automatically converting to NFC.`,
        {filename: source.name, lineno}
      )
    }

    wordform = wordform.trim()

    countText = (countText || '').trim();
    let count = parseInt(countText, 10);

    // When parsing a decimal integer fails (e.g., blank or something else):
    if (!isFinite(count)) {
      // TODO: is this the right thing to do?
      // Treat it like a hapax legonmenom -- it exist, but only once.
      count = 1;
    }

    if (wordsSeenInThisFile.has(wordform)) {
      // The same word seen across multiple files is fine,
      // but a word seen multiple times in one file is a problem!
      log(
        KeymanCompilerError.CWARN_DuplicateWordInSameFile,
        `duplicate word “${wordform}” found in same file; summing counts`,
        {filename: source.name, lineno}
      )
    }
    wordsSeenInThisFile.add(wordform);

    wordlist[wordform] = (wordlist[wordform] || 0) + count;
  }
}

type LineNoAndText = [number, string];

interface WordListSource {
  readonly name: string;
  lines(): Iterable<LineNoAndText>;
}

class WordListFromMemory implements WordListSource {
  readonly name = '<memory>';
  private readonly _contents: string;

  constructor(contents: string) {
    this._contents = contents;
  }

  *lines() {
    yield *enumerateLines(this._contents.split(NEWLINE_SEPARATOR));
  }
}

/**
 * Yields pairs of [lineno, line], given an Array of lines.
 */
export function* enumerateLines(lines: string[]): Generator<LineNoAndText> {
    let i = 1;
    for (let line of lines) {
      yield [i, line];
      i++;
    }
}

namespace Trie {
  /**
   * An **opaque** type for a string that is exclusively used as a search key in
   * the trie. There should be a function that converts arbitrary strings
   * (queries) and converts them into a standard search key for a given language
   * model.
   *
   * Fun fact: This opaque type has ALREADY saved my bacon and found a bug!
   */
  type SearchKey = string & { _: 'SearchKey'};

  /**
   * A function that converts a string (word form or query) into a search key
   * (secretly, this is also a string).
   */
  export interface SearchTermToKey {
    (wordform: string): SearchKey;
  }

  // The following trie implementation has been (heavily) derived from trie-ing
  // by Conrad Irwin.
  //
  // trie-ing is distributed under the terms of the MIT license, reproduced here:
  //
  //   The MIT License
  //   Copyright (c) 2015-2017 Conrad Irwin <conrad.irwin@gmail.com>
  //   Copyright (c) 2011 Marc Campbell <marc.e.campbell@gmail.com>
  //
  //   Permission is hereby granted, free of charge, to any person obtaining a copy
  //   of this software and associated documentation files (the "Software"), to deal
  //   in the Software without restriction, including without limitation the rights
  //   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  //   copies of the Software, and to permit persons to whom the Software is
  //   furnished to do so, subject to the following conditions:
  //
  //   The above copyright notice and this permission notice shall be included in
  //   all copies or substantial portions of the Software.
  //
  //   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  //   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  //   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  //   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  //   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  //   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  //   THE SOFTWARE.
  //
  // See: https://github.com/ConradIrwin/trie-ing/blob/df55d7af7068d357829db9e0a7faa8a38add1d1d/LICENSE

  /**
   * An entry in the prefix trie. The matched word is "content".
   */
  interface Entry {
    content: string;
    key: SearchKey;
    weight: number;
  }

  /**
   * The trie is made up of nodes. A node can be EITHER an internal node (whose
   * only children are other nodes) OR a leaf, which actually contains the word
   * form entries.
   */
  type Node = InternalNode | Leaf;

  /**
   * An internal node.
   */
  interface InternalNode {
    type: 'internal';
    weight: number;
    // TODO: As an optimization, "values" can be a single string!
    values: string[];
    children: { [codeunit: string]: Node };
    unsorted?: true;
  }

  /**
   * A leaf node.
   */
  interface Leaf {
    type: 'leaf';
    weight: number;
    entries: Entry[];
    unsorted?: true;
  }

  /**
   * A sentinel value for when an internal node has contents and requires an
   * "internal" leaf. That is, this internal node has content. Instead of placing
   * entries as children in an internal node, a "fake" leaf is created, and its
   * key is this special internal value.
   *
   * The value is a valid Unicode BMP code point, but it is a "non-character".
   * Unicode will never assign semantics to these characters, as they are
   * intended to be used internally as sentinel values.
   */
  const INTERNAL_VALUE = '\uFDD0';

  /**
   * Builds a trie from a word list.
   *
   * @param wordlist    The wordlist with non-negative weights.
   * @param keyFunction Function that converts word forms into indexed search keys
   * @returns A JSON-serialiable object that can be given to the TrieModel constructor.
   */
  export function buildTrie(wordlist: WordList, keyFunction: SearchTermToKey): object {
    let root = new Trie(keyFunction).buildFromWordList(wordlist).root;
    return {
      totalWeight: sumWeights(root),
      root: root
    }
  }

  /**
   * Wrapper class for the trie and its nodes and wordform to search
   */
  class Trie {
    readonly root = createRootNode();
    toKey: SearchTermToKey;
    constructor(wordform2key: SearchTermToKey) {
      this.toKey = wordform2key;
    }

    /**
     * Populates the trie with the contents of an entire wordlist.
     * @param words a list of word and count pairs.
     */
    buildFromWordList(words: WordList): Trie {
      for (let [wordform, weight] of Object.entries(words)) {
        let key = this.toKey(wordform);
        addUnsorted(this.root, { key, weight, content: wordform }, 0);
      }
      sortTrie(this.root);
      return this;
    }
  }

  // "Constructors"
  function createRootNode(): Node {
    return {
      type: 'leaf',
      weight: 0,
      entries: []
    };
  }

  // Implement Trie creation.

  /**
   * Adds an entry to the trie.
   *
   * Note that the trie will likely be unsorted after the add occurs. Before
   * performing a lookup on the trie, use call sortTrie() on the root note!
   *
   * @param node Which node should the entry be added to?
   * @param entry the wordform/weight/key to add to the trie
   * @param index the index in the key and also the trie depth. Should be set to
   *              zero when adding onto the root node of the trie.
   */
  function addUnsorted(node: Node, entry: Entry, index: number = 0) {
    // Each node stores the MAXIMUM weight out of all of its decesdents, to
    // enable a greedy search through the trie.
    node.weight = Math.max(node.weight, entry.weight);

    // When should a leaf become an interior node?
    // When it already has a value, but the key of the current value is longer
    // than the prefix.
    if (node.type === 'leaf' && index < entry.key.length && node.entries.length >= 1) {
      convertLeafToInternalNode(node, index);
    }

    if (node.type === 'leaf') {
      // The key matches this leaf node, so add yet another entry.
      addItemToLeaf(node, entry);
    } else {
      // Push the node down to a lower node.
      addItemToInternalNode(node, entry, index);
    }

    node.unsorted = true;
  }

  /**
   * Adds an item to the internal node at a given depth.
   * @param item
   * @param index
   */
  function addItemToInternalNode(node: InternalNode, item: Entry, index: number) {
    let char = item.key[index];
    if (!node.children[char]) {
      node.children[char] = createRootNode();
      node.values.push(char);
    }
    addUnsorted(node.children[char], item, index + 1);
  }

  function addItemToLeaf(leaf: Leaf, item: Entry) {
    leaf.entries.push(item);
  }

  /**
   * Mutates the given Leaf to turn it into an InternalNode.
   *
   * NOTE: the node passed in will be DESTRUCTIVELY CHANGED into a different
   * type when passed into this function!
   *
   * @param depth depth of the trie at this level.
   */
  function convertLeafToInternalNode(leaf: Leaf, depth: number): void {
    let entries = leaf.entries;

    // Alias the current node, as the desired type.
    let internal = (<unknown> leaf) as InternalNode;
    internal.type = 'internal';

    delete leaf.entries;
    internal.values = [];
    internal.children = {};

    // Convert the old values array into the format for interior nodes.
    for (let item of entries) {
      let char: string;
      if (depth < item.key.length) {
        char = item.key[depth];
      } else {
        char = INTERNAL_VALUE;
      }

      if (!internal.children[char]) {
        internal.children[char] = createRootNode();
        internal.values.push(char);
      }
      addUnsorted(internal.children[char], item, depth + 1);
    }

    internal.unsorted = true;
  }

  /**
   * Recursively sort the trie, in descending order of weight.
   * @param node any node in the trie
   */
  function sortTrie(node: Node) {
    if (node.type === 'leaf') {
      if (!node.unsorted) {
        return;
      }

      node.entries.sort(function (a, b) { return b.weight - a.weight; });
    } else {
      // We MUST recurse and sort children before returning.
      for (let char of node.values) {
        sortTrie(node.children[char]);
      }

      if (!node.unsorted) {
        return;
      }

      node.values.sort((a, b) => {
        return node.children[b].weight - node.children[a].weight;
      });
    }

    delete node.unsorted;
  }

  /**
   * O(n) recursive traversal to sum the total weight of all leaves in the
   * trie, starting at the provided node.
   *
   * @param node The node to start summing weights.
   */
  function sumWeights(node: Node): number {
    if (node.type === 'leaf') {
      return node.entries
        .map(entry => entry.weight)
        .reduce((acc, count) => acc + count, 0);
    } else {
      return Object.keys(node.children)
        .map((key) => sumWeights(node.children[key]))
        .reduce((acc, count) => acc + count, 0);
    }
  }
}

/**
 * Converts wordforms into an indexable form. It does this by
 * normalizing the letter case of characters INDIVIDUALLY (to disregard
 * context-sensitive case transformations), normalizing to NFKD form,
 * and removing common diacritical marks.
 *
 * This is a very speculative implementation, that might work with
 * your language. We don't guarantee that this will be perfect for your
 * language, but it's a start.
 *
 * This uses String.prototype.normalize() to convert normalize into NFKD.
 * NFKD neutralizes some funky distinctions, e.g., ꬲ, ｅ, e should all be the
 * same character; plus, it's an easy way to separate a Latin character from
 * its diacritics; Even then, orthographies regularly use code points
 * that, under NFKD normalization, do NOT decompose appropriately for your
 * language (e.g., SENĆOŦEN, Plains Cree in syllabics).
 *
 * Use this in early iterations of the model. For a production lexical model,
 * you will probably write/generate your own key function, tailored to your
 * language. There is a chance the default will work properly out of the box.
 */
export function defaultSearchTermToKey(wordform: string): string {
  return Array.from(wordform)
    .map(c => c.toLowerCase())
    .join('')
    .normalize('NFKD')
    // Remove any combining diacritics (if input is in NFKD)
    .replace(/[\u0300-\u036F]/g, '');
}

/**
 * Detects the encoding of a text file.
 *
 * Supported encodings are:
 *
 *  - UTF-8, with or without BOM
 *  - UTF-16, little endian, with BOM
 *
 * UTF-16 in big endian is explicitly NOT supported! The reason is two-fold:
 * 1) Node does not support it without resorting to an external library (or
 * swapping every byte in the file!); and 2) I'm not sure anything actually
 * outputs in this format anyway!
 *
 * @param filename filename of the file to detect encoding
 */
export function detectEncodingFromBuffer(buffer: Int8Array | Buffer): 'utf8' | 'utf16le' {
  // Note: BOM is U+FEFF
  // In little endian, this is 0xFF 0xFE
  if (buffer[0] == 0xFF && buffer[1] == 0xFE) {
    return 'utf16le';
  } else if (buffer[0] == 0xFE && buffer[1] == 0xFF) {
    // Big Endian, is NOT supported because Node does not support it (???)
    // See: https://stackoverflow.com/a/14551669/6626414
    throw new Error('UTF-16BE is unsupported')
  } else {
    // Assume its in UTF-8, with or without a BOM.
    return 'utf8';
  }
}
