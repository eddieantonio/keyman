Keyman Developer
================

Eddie's fork:

Install
-------

    yarn add @predictive-text-studio/lexical-model-compiler

or

    npm install @predictive-text-studio/lexical-model-compiler --save

Usage
-----

Check `source/index.ts` for more details!

```typescript
import {compileModelFromLexicalModelSource} from "@predictive-text-studio/lexical-model-compiler";

let javaScriptCode: string = compileModelFromLexicalModelSource({
  format: "trie-1.0",
  source: [{
    name: "<memory>",
    *lines() {
      yield [1, "hello,100"];
    }
  }]
});

console.log(javaScriptCode);
```

How to build from source
------------------------

Run `build.sh`:

    ./build.sh


How to run the tests
--------------------

    ./build.sh -test
