/**
 * Re-export the good bits from in the lexical-model-compiler submodule!
 */
import LexicalModelCompiler, { DefaultLexicalModelCompiler, ModelSourceError } from "./lexical-model-compiler";
export default LexicalModelCompiler;
export {DefaultLexicalModelCompiler, ModelSourceError};