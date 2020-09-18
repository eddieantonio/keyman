Keyman Developer
================

@eddieantonio's fork:

Install
-------

    yarn add @eddieantonio/lexical-model-compiler

or

    npm install @eddieantonio/lexical-model-compiler --save

Usage
-----

Check `source/index.ts` for more details!

```typescript
import {compileModelFromLexicalModelSource}
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