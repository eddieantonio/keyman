/*
  lexical-model-compiler.ts: base file for lexical model compiler.
*/

/// <reference path="./lexical-model.ts" />
/// <reference path="./model-info-file.ts" />

import * as ts from "typescript";
import * as path from "path";
import { compileTrieFromWordlist, defaultSearchTermToKey } from "./build-trie";
import { wordListFromFilenames } from "./build-trie/with-node-fs";
import {decorateWithJoin} from "./join-word-breaker-decorator";
import {decorateWithScriptOverrides} from "./script-overrides-decorator";

/**
 * A string that MUST be a valid snippet of JavaScript code.
 */
type JavaScriptSnippet = string & { _js: true };

export default class LexicalModelCompiler {
  snippets: JavaScriptSnippet[] = [];

  private emit(code: JavaScriptSnippet): void {
    this.snippets.push(code);
  }

  private get func() {
    return this.snippets.join('');
  }
  
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
    // TODO: add metadata in comment
    const filePrefix = `(function() {\n'use strict';\n`;
    const fileSuffix = `})();`;
    this.emit(filePrefix as JavaScriptSnippet)

    //
    // Emit the model as code and data
    //

    switch(modelSource.format) {
      case "custom-1.0":
        throw new ModelSourceError(`Unimplemented model format: ${modelSource.format}`);
      case "trie-1.0":
        // Convert all relative path names to paths relative to the enclosing
        // directory. This way, we'll read the files relative to the model.ts
        // file, rather than the current working directory.
        let filenames = modelSource.sources.map(filename => path.join(sourcePath, filename));
        let wordlist = wordListFromFilenames(filenames);

        // Use the default search term to key function, if left unspecified.
        let searchTermToKey = modelSource.searchTermToKey || defaultSearchTermToKey;

        this.emit(`LMLayerWorker.loadModel(new models.TrieModel(${
          compileTrieFromWordlist(wordlist, searchTermToKey)
        }, {\n` as JavaScriptSnippet);

        let wordBreakerSourceCode = compileWordBreaker(normalizeWordBreakerSpec(modelSource.wordBreaker));
        this.emit(`  wordBreaker: ${wordBreakerSourceCode},\n` as JavaScriptSnippet);

        this.emit(`  searchTermToKey: ${searchTermToKey.toString()},\n` as JavaScriptSnippet);

        if (modelSource.punctuation) {
          this.emit(`  punctuation: ${JSON.stringify(modelSource.punctuation)},\n` as JavaScriptSnippet);
        }
        this.emit(`}));\n` as JavaScriptSnippet);
        break;
      default:
        throw new ModelSourceError(`Unknown model format: ${modelSource.format}`);
    }

    this.emit(fileSuffix as JavaScriptSnippet);

    return this.func;
  }

  transpileSources(sources: Array<string>): Array<string> {
    return sources.map((source) => ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.None }
      }).outputText
    );
  };

  logError(s: string) {
    console.error(require('chalk').red(s));
  };
};

export class LegacyLexicalModelCompiler extends LexicalModelCompiler {
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
    return (new LexicalModelCompiler).generateLexicalModelCode(model_id, modelSource, sourcePath);
  }
}

export class ModelSourceError extends Error {
}

/**
 * Returns a JavaScript expression (as a string) that can serve as a word
 * breaking function.
 */
function compileWordBreaker(spec: WordBreakerSpec): string {
  let wordBreakerCode = compileInnerWordBreaker(spec.use);

  if (spec.joinWordsAt) {
    wordBreakerCode = compileJoinDecorator(spec, wordBreakerCode);
  }

  if (spec.overrideScriptDefaults) {
    wordBreakerCode = compileScriptOverrides(spec, wordBreakerCode);
  }

  return wordBreakerCode;
}

function compileJoinDecorator(spec: WordBreakerSpec, existingWordBreakerCode: string) {
  // Bundle the source of the join decorator, as an IIFE,
  // like this: (function join(breaker, joiners) {/*...*/}(breaker, joiners))
  // The decorator will run IMMEDIATELY when the model is loaded,
  // by the LMLayer returning the decorated word breaker to the
  // LMLayer model.
  let joinerExpr: string = JSON.stringify(spec.joinWordsAt)
  return `(${decorateWithJoin.toString()}(${existingWordBreakerCode}, ${joinerExpr}))`;
}

function compileScriptOverrides(spec: WordBreakerSpec, existingWordBreakerCode: string) {
  return `(${decorateWithScriptOverrides.toString()}(${existingWordBreakerCode}, '${spec.overrideScriptDefaults}'))`;
}

/**
 * Compiles the base word breaker, that may be decorated later.
 * Returns the source code of a JavaScript expression.
 */
function compileInnerWordBreaker(spec: SimpleWordBreakerSpec): string {
  if (typeof spec === "string") {
    // It must be a builtin word breaker, so just instantiate it.
    return `wordBreakers['${spec}']`;
  } else {
    // It must be a function:
    return spec.toString()
      // Note: the .toString() might just be the property name, but we want a
      // plain function:
      .replace(/^wordBreak(ing|er)\b/, 'function');
  }
}

/**
 * Given a word breaker specification in any of the messy ways,
 * normalizes it to a common form that the compiler can deal with.
 */
function normalizeWordBreakerSpec(wordBreakerSpec: LexicalModelSource["wordBreaker"]): WordBreakerSpec {
  if (wordBreakerSpec == undefined) {
    // Use the default word breaker when it's unspecified
    return { use: 'default' };
  } else if (isSimpleWordBreaker(wordBreakerSpec)) {
    // The word breaker was passed as a literal function; use its source code.
    return { use: wordBreakerSpec };
  } else if (wordBreakerSpec.use) {
    return wordBreakerSpec;
  } else {
    throw new Error(`Unknown word breaker: ${wordBreakerSpec}`);
  }
}

function isSimpleWordBreaker(spec: WordBreakerSpec | SimpleWordBreakerSpec): spec is SimpleWordBreakerSpec  {
  return typeof spec === "function" || spec === "default" || spec === "ascii";
}
