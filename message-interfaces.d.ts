/*
 * Copyright (c) 2018 National Research Council Canada (author: Eddie A. Santos)
 * Copyright (c) 2018 SIL International
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * A token
 *
 * TODO: this should be an opaque type!
 */
type Token = number;

/**
 * The different message kinds.
 */
type MessageKind = 'initialize' | 'ready' | 'predict' | 'suggestions';

type Message = InitializeMessage
             | ReadyMessage
             | PredictMessage
             | SuggestionsMessage;

interface InitializeMessage {
  message: 'initialize';
  /**
   * Path to the model. There are no concrete restrictions on the path
   * to the model, so long as the LMLayer can successfully use it to
   * initialize the model.
   */
  model: string;
  configuration: {
    /**
     * Whether the platform supports right contexts.
     * The absence of this rule implies false.
     */
    supportsRightContexts?: false,

    /**
     * Whether the platform supports deleting to the right.
     * The absence of this rule implies false.
     */
    supportsDeleteRight?: false,

    /**
     * The maximum amount of UTF-16 code units that the keyboard will
     * provide to the left of the cursor.
     */
    maxLeftContextCodeUnits: 32,

    /**
     * The maximum amount of code units that the keyboard will provide to
     * the right of the cursor. The absence of this rule implies 0.
     * See also, [[supportsRightContexts]].
     */
    maxRightContextCodeUnits: 32,
  }
}

interface ReadyMessage {
  message: 'ready';
  configuration: {
    /**
     * How many UTF-16 code units maximum to send as the context to the
     * left of the cursor ("left" in the Unicode character stream).
     *
     * Affects the `context` property sent in `predict` messages.
     *
     * While the left context MUST NOT bisect surrogate pairs, they MAY
     * bisect graphical clusters.
     */
    leftContextCodeUnits: number,

    /**
     * How many UTF-16 code units maximum to send as the context to the
     * right of the cursor ("right" in the Unicode character stream).
     *
     * Affects the `context` property sent in `predict` messages.
     *
     * While the left context MUST NOT bisect surrogate pairs, they MAY
     * bisect graphical clusters.
     */
    rightContextCodeUnits: number,
  };
}

interface PredictMessage {
  message: 'predict';
  token: Token;
  context: Context;
  transform: Transform;
}

interface SuggestionsMessage {
  message: 'suggestions';
  token: Token;
  /**
   * An ordered array of [[Suggestion]] objects.
   * The suggestions are ordered from most probable, to least
   * probable. In practice, only a handful of suggestions can
   * be display on the screen, depending on the language. Plan
   * to produce the top three suggestions.
   */
  suggestions: Suggestion[];
}

/**
 * The context is the text surrounding the insertion point,
 * before any transforms are applied to the text buffer.
 */
interface Context {
  /**
   * Up to maxLeftContextCodeUnits code units of Unicode scalar value
   * (i. e., characters) to the left of the insertion point in the
   * buffer. If there is nothing to the left of the buffer, this returns
   * an empty string.
   */
  left: USVString;

  /**
   * Up to maxRightContextCodeUnits code units of Unicode scalar value
   * (i. e., characters) to the right of the insertion point in the
   * buffer. If there is nothing to the right of the buffer, this returns
   * an empty string.
   */
  right?: USVString;

  /**
   * Whether the insertion point is at the start of the buffer.
   */
  startOfBuffer: boolean;

  /**
   * Whether the insertion point is at the end of the buffer.
   */
  endOfBuffer: boolean;
}

/**
 * A suggested change. Bundles the suggested [[Transform]], along
 * with a way to display it on the screen.
 */
interface Suggestion {
  transform: Transform;
  /**
   * A string to display the suggestion to the typist.
   * This should aid the typist understand what the transform
   * will do to their text.
   */
  displayAs: string;
}
