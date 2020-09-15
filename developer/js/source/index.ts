/**
 * NOTE: None of the members imported here (and subsequently exported) will use
 * Node imports, therefore, they are safe to use in the Browser or WebWorker
 * context.
 */
import LexicalModelCompiler, { DefaultLexicalModelCompiler, ModelSourceError } from "./lexical-model-compiler/lexical-model-compiler";
import { LineNoAndText, WordList, WordListSource } from "./lexical-model-compiler/wordlist";

export {
  /* Interfaces and types */
  LexicalModelCompiler,
  LineNoAndText,
  WordList,
  WordListSource,

  /* Concrete implementations */
  DefaultLexicalModelCompiler,
  ModelSourceError,
};