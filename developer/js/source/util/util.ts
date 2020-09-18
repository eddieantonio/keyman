// TODO: this file is really only for lexical model compiler tests. Find a good name.
//
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { SysExits } from "./sysexits";
import { LegacyLexicalModelCompiler } from "../lexical-model-compiler/legacy-lexical-model-compiler";
import { LexicalModelSource } from '../lexical-model-compiler/lexical-model-source';

/**
 * Compiles a model.ts file, using paths relative to its location.
 *
 * @param filename path to model.ts source.
 * @return model source code
 */
export function compileModel(filename: string): string {
  let modelSource = loadFromFilename(filename);
  let containingDirectory = path.dirname(filename);

  return LegacyLexicalModelCompiler
    .compileUsingLegacyInterface('<unknown>', modelSource, containingDirectory);
}

/**
 * An ECMAScript module as emitted by the TypeScript compiler.
 */
interface ES2015Module {
  /** This is always true. */
  __esModule: boolean;
  'default'?: unknown;
}

/**
 * Loads a lexical model's source module from the given filename.
 *
 * @param filename path to the model source file.
 */
export function loadFromFilename(filename: string): LexicalModelSource {
  let sourceCode = fs.readFileSync(filename, 'utf8');
  // Compile the module to JavaScript code.
  // NOTE: transpile module does a very simple TS to JS compilation.
  // It DOES NOT check for types!
  let compilationOutput = ts.transpile(sourceCode, {
    // Our runtime should support ES6 with Node/CommonJS modules.
    target: ts.ScriptTarget.ES2015,
    module: ts.ModuleKind.CommonJS,
  });
  // Turn the module into a function in which we can inject a global.
  let moduleCode = '(function(exports){' + compilationOutput + '})';

  // Run the module; its exports will be assigned to `moduleExports`.
  let moduleExports: Partial<ES2015Module> = {};
  let module = eval(moduleCode);
  module(moduleExports);

  if (!moduleExports['__esModule'] || !moduleExports['default']) {
    console.error(`Model source '${filename}' does have a default export. Did you remember to write \`export default source;\`?`);
    // TODO: throw an Error instead.
    process.exit(SysExits.EX_DATAERR);
  }

  return moduleExports['default'] as LexicalModelSource;
}
