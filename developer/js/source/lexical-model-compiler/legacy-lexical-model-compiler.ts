import * as path from "path";
import { WordListFromFilename } from "./build-trie/with-node-fs";
import { DefaultLexicalModelCompiler } from "./lexical-model-compiler";



export class LegacyLexicalModelCompiler extends DefaultLexicalModelCompiler {
  /**
   * Returns the generated code for the model that will ultimately be loaded by
   * the LMLayer worker. This code contains all model parameters, and specifies
   * word breakers and auxilary functions that may be required.
   *
   * @deprecated
   * @param model_id      The model ID. TODO: not sure if this is actually required!
   * @param modelSource   A specification of the model to compile
   * @param sourcePath    Where to find auxilary sources files
   */
  generateLexicalModelCode(model_id: string, modelSource: LexicalModelSource, sourcePath: string) {
    return this.compile(modelSource, (filename: string) => {
      // Convert all relative path names to paths relative to the enclosing
      // directory. This way, we'll read the files relative to the model.ts
      // file, rather than the current working directory.
      let adjustedFileName = path.join(sourcePath, filename);
      return new WordListFromFilename(adjustedFileName);
    });
  }

  /**
   * Returns the generated code for the model that will ultimately be loaded by
   * the LMLayer worker. This code contains all model parameters, and specifies
   * word breakers and auxilary functions that may be required.
   *
   * @param model_id      The model ID. TODO: not sure if this is actually required!
   * @param modelSource   A specification of the model to compile
   * @param sourcePath    Where to find auxilary sources files
   */
  static compileUsingLegacyInterface(model_id: string, modelSource: LexicalModelSource, sourcePath: string): string {
    return (new LegacyLexicalModelCompiler).generateLexicalModelCode(model_id, modelSource, sourcePath);
  }
}
