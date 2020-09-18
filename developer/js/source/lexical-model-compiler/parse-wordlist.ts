import { log, KeymanCompilerError } from "../errors";
import { WordList, WordListSource } from "./wordlist";

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

export function parseWordList(wordlist: WordList, source: WordListSource): void {
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
        { filename: source.name, lineno }
      );
    }

    wordform = wordform.trim();

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
        { filename: source.name, lineno }
      );
    }
    wordsSeenInThisFile.add(wordform);

    wordlist[wordform] = (wordlist[wordform] || 0) + count;
  }
}
