/**
 * @file helpers
 * 
 * Globally-defined helper functions for use in in Mocha tests.
 */

// Choose the appropriate global object. Either `global` in
// Node, or `window` in browsers.
var _ = global || window;

/**
 * Creates a MessageEvent (for inter-worker communication), with the given data payload.
 *
 * @param {*} data 
 */
_.createMessageEventWithData = function createMessageEventWithData(data) {
  return { data };
}

/**
 * A valid model that suggests exactly what you want it to suggest.
 * 
 * @returns {ModelDescription}
 */
_.dummyModel = function dummyModel(futureSuggestions) {
  return {
    type: 'dummy',
    futureSuggestions: futureSuggestions || []
  };
}
/**
 * Capabilities of a keyboard that will ONLY send left-sided capabilities.
 * The keyboard does not support deleting to the right.
 *
 * @returns {Capabilities}
 */
_.defaultCapabilities = function defaultCapabilities() {
  return {
    maxLeftContextCodeUnits: 64
  };
}

/**
 * Returns the Context of an empty buffer; no text, at both the start and
 * end of the buffer.
 * 
 * @returns {Context}
 */
_.emptyContext = function emptyContext() {
  return {
    left: '',
    startOfBuffer: true,
    endOfBuffer: true
  };
}

/**
 * Returns a Transform that, when applied, makes no changes to the buffer.
 *
 * @returns {Transform}
 */
_.zeroTransform = function zeroTransform() {
  return {
    insert: '',
    deleteLeft: 0,
  };
}

/**
 * Returns a random token. NOT guaranteed to be unique.
 *
 * @returns {Token}
 */
_.randomToken = function randomToken() {
  var range =  Number.MAX_SAFE_INTEGER - Number.MIN_SAFE_INTEGER;
  return Math.random() * range + Number.MIN_SAFE_INTEGER;
}

// Use fixtures used in browser tests IN NODE!
if (typeof require === 'function') {
  _.iGotDistractedByHazel = function () {
    return jsonFixture('future_suggestions/i_got_distracted_by_hazel');
  }

  /**
   * Return a JSON fixture
   */
  _.jsonFixture = function (name) {
    // Assuming this file structure:
    // .
    // ├── helpers.js
    // └── in_browser
    //     └── json
    //         ├── future_suggestions
    //         │   └── ...
    //         └── wordlists
    //             └── ...
    return require('./in_browser/json/' + name);
  }

  var fs = require("fs");
  var vm = require("vm");

  // This worker-global function does not exist by default in Node!
  _.importScriptsWith = function(context) {
      return function() { // the constructed context's importScripts method.
      debugger
      for(var i=0; i < arguments.length; i++) {
        context = vm.createContext(context);
        var script = new vm.Script(fs.readFileSync(arguments[i]));
        script.runInContext(context);
      }
    }
  }
}
