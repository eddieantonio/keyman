/**
 * A word list is (conceptually) an array of pairs: the concrete word form itself + a
 * non-negative count.
 *
 * Since each word should only appear once within the list, we represent it with
 * an associative array pattern keyed by the wordform.
 */

export type WordList = { [wordform: string]: number; };

/**
 * All the information is required by the parsing infrastructure to parse a
 * compile a wordlist.
 */
export interface WordListSource {
  readonly name: string;
  lines(): Iterable<LineNoAndText>;
}
export type LineNoAndText = [number, string];