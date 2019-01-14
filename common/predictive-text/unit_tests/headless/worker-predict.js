var assert = require('chai').assert;
var sinon = require('sinon');

let LMLayerWorker = require('../../build/intermediate');


describe('LMLayerWorker', function () {
  describe('#predict()', function () {
    it('should send back suggestions', function () {
      var suggestion = {
        transform: {
          insert: 'I ',
          deleteLeft: 0
        },
        displayAs: 'I'
      };

      // Initialize the worker with a model that will produce one suggestion.
      var fakePostMessage = sinon.fake();
      var worker = new LMLayerWorker({ postMessage: fakePostMessage });
      worker.onMessage(createMessageEventWithData({
        message: 'initialize',
        model: dummyModel([
          [suggestion]
        ]),
        capabilities: defaultCapabilities()
      }));
      sinon.assert.calledWithMatch(fakePostMessage.lastCall, {
        message: 'ready',
      });
      
      var token = randomToken();

      // Now predict! We should get the suggestions back.
      worker.onMessage(createMessageEventWithData({
        message: 'predict',
        token: token,
        transform: zeroTransform(),
        context: emptyContext()
      }));
      sinon.assert.calledWithMatch(fakePostMessage.lastCall, {
        message: 'suggestions',
        token: token,
        suggestions: sinon.match.array.deepEquals([suggestion])
      });
    });

    afterEach(function () {
      // Restore all fakes.
      sinon.restore();
    });
  });

  // TODO: factor into helpers.
  function randomToken() {
    var range =  Number.MAX_SAFE_INTEGER - Number.MIN_SAFE_INTEGER;
    return Math.random() * range + Number.MIN_SAFE_INTEGER;
  }

});
