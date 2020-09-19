/**
 * Re-export the good bits from in the lexical-model-compiler submodule!
 */
import LexicalModelCompiler, { DefaultLexicalModelCompiler, ModelSourceError } from "./lexical-model-compiler";
import {WordList} from './wordlist';
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
