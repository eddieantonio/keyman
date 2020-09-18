/**
 * Re-export the good bits from in the lexical-model-compiler submodule!
 */
import LexicalModelCompiler, { DefaultLexicalModelCompiler, ModelSourceError } from "./lexical-model-compiler";
import {WordList} from './wordlist';

export default LexicalModelCompiler;
export {
  DefaultLexicalModelCompiler,
  ModelSourceError,
  WordList,
};

export function compileModelFromLexicalModelSource(source: LexicalModelSource): string {
  return (new DefaultLexicalModelCompiler).compile(source, () => {
    throw new Error("Not implemented: provide sources via filename")
  });
}