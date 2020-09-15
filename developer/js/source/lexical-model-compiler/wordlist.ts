/**
 * A word list is (conceptually) an array of pairs: the concrete word form itself + a
 * non-negative count.
 *
 * Since each word should only appear once within the list, we represent it with
 * an associative array pattern keyed by the wordform.
 */

export type WordList = { [wordform: string]: number; };
