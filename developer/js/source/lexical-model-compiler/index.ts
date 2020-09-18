/**
 * Re-export the good bits from in the lexical-model-compiler submodule!
 */
import LexicalModelCompiler, { DefaultLexicalModelCompiler, ModelSourceError } from "./lexical-model-compiler";
export default LexicalModelCompiler;
export {DefaultLexicalModelCompiler, ModelSourceError};

export function compileModelFromLexicalModelSource(source: LexicalModelSource): string {
  return (new DefaultLexicalModelCompiler).compile(source, () => {
    throw new Error("Not implemented: provide sources via filename")
  });
}