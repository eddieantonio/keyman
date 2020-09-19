/**
 * Re-export the good bits from in the lexical-model-compiler submodule!
 */
import LexicalModelCompiler, { DefaultLexicalModelCompiler, ModelSourceError } from "./lexical-model-compiler";
import {WordList, WordListSource} from './wordlist';
import {LexicalModelSource} from './lexical-model-source';

export default LexicalModelCompiler;
export {
  DefaultLexicalModelCompiler,
  ModelSourceError,
  WordList,
};

/**
 * Given a {@link LexicalModelSource}, this returns the compiled JavaScript
 * model that can be packaged into a .kmp file.
 *
 * @returns {string} the generated model code
 */
export function compileModelFromLexicalModelSource(source: LexicalModelSource): string {
  return (new DefaultLexicalModelCompiler).compile(source, () => {
    throw new Error("Not implemented: provide sources via filename")
  });
}

type WordWithCount = [string, number];

/**
 * A {@link WordListSource} with the data given as an array of [word, count]
 * pairs. Useful if you have already parsed out all of the lines in advanced.
 */
export class WordListFromArray implements WordListSource {
  readonly name: string;
  private _data: WordWithCount[];

  constructor(name: string, data: WordWithCount[]) {
    this.name = name;
    this._data = data;
  }

  *lines(): Generator<[number, string]> {
    let lineno = 1;
    for (let [word, count] of this._data) {
      yield [lineno, `${word}\t${count}`];
      lineno++;
    }
  }
}
