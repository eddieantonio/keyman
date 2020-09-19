/**
 * NOTE: None of the members imported here (and subsequently exported) will use
 * Node imports, therefore, they are safe to use in the Browser or WebWorker
 * context.
 */
import LexicalModelCompiler, {
  DefaultLexicalModelCompiler,
  ModelSourceError,
  WordListFromArray,
  compileModelFromLexicalModelSource,
} from "./lexical-model-compiler";
import {
  LineNoAndText,
  WordList,
  WordListSource,
} from "./lexical-model-compiler/wordlist";
import { LexicalModelSource } from "./lexical-model-compiler/lexical-model-source";

export {
  /* Interfaces and types */
  LexicalModelCompiler,
  LexicalModelSource,
  LineNoAndText,
  WordList,
  WordListSource,
  /* Concrete implementations */
  DefaultLexicalModelCompiler,
  ModelSourceError,
  WordListFromArray,
  /* Functions */
  compileModelFromLexicalModelSource,
};
