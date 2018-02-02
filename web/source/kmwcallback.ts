/// <reference path="kmwexthtml.ts" />  // Includes KMW-added property declaration extensions for HTML elements.
/// <reference path="kmwtypedefs.ts" /> // Includes type definitions for basic KMW types.
/// <reference path="kmwbase.ts" />

/***
   KeymanWeb 10.0
   Copyright 2017 SIL International
***/

/**
 * Cache of context storing and retrieving return values from KC
 * Must be reset prior to each keystroke and after any text changes
 * MCD 3/1/14   
 **/         
class CachedContext {
  _cache: string[][] = [];
  
  reset(): void { 
    this._cache = []; 
  }

  get(n: number, ln: number): string { 
    // return null; // uncomment this line to disable context caching
    if(typeof this._cache[n] == 'undefined') {
      return null;
    } else if(typeof this._cache[n][ln] == 'undefined') {
      return null;
    }
    return this._cache[n][ln];
  }

  set(n: number, ln: number, val: string): void { 
    if(typeof this._cache[n] == 'undefined') { 
      this._cache[n] = []; 
    } 
    this._cache[n][ln] = val; 
  }
};

// Defines the base Deadkey-tracking object.
class Deadkey {
  p: number;  // Position of deadkey
  d: number;  // Numerical id of the deadkey
  matched: number;

  constructor(pos: number, id: number) {
    this.p = pos;
    this.d = id;
  }

  match(p: number, d: number): boolean {
    var result:boolean = (this.p == p && this.d == d);
    this.matched = result ? 1 : 0;

    return result;
  }

  set(): void {
    this.matched = 1;
  }

  reset(): void {
    this.matched = 0;
  }
}

class BeepData {
  e: HTMLElement;
  c: string;

  constructor(e: HTMLElement) {
    this.e = e;
    this.c = e.style.backgroundColor;
  }

  reset(): void {
    this.e.style.backgroundColor = this.c;
  }
}

class KeyboardInterface {
  keymanweb: KeymanBase;
  cachedContext: CachedContext = new CachedContext();

  TSS_LAYER:    number = 33;
  TSS_PLATFORM: number = 31;

  _AnyIndices:  number[] = [];    // AnyIndex - array of any/index match indices
  _BeepObjects: BeepData[] = [];  // BeepObjects - maintains a list of active 'beep' visual feedback elements
  _BeepTimeout: number = 0;       // BeepTimeout - a flag indicating if there is an active 'beep'. 
                                  // Set to 1 if there is an active 'beep', otherwise leave as '0'.
  _DeadKeys: Deadkey[] = [];      // DeadKeys - array of matched deadkeys

  constructor(kmw: KeymanBase) {
    this.keymanweb = kmw;
  }

  /**
   * Function     KSF
   * Scope        Public
   * Description  Save keyboard focus
   */    
  saveFocus(): void {
    DOMEventHandlers.states._IgnoreNextSelChange = 1;
  }
    
  /**
   * Function     KT
   * Scope        Public
   * @param       {string}      Ptext     Text to insert
   * @param       {?number}     PdeadKey  Dead key number, if any (???)
   * @return      {boolean}               true if inserted
   * Description  Insert text into active control
   */    
  insertText(Ptext: string, PdeadKey:number): boolean {
    this.resetContextCache();
    //_DebugEnter('InsertText');
    var Lelem = this.keymanweb.domManager.getLastActiveElement(), Ls, Le, Lkc, Lsel, Lv=false;
    if(Lelem != null) {
      Ls=Lelem._KeymanWebSelectionStart;
      Le=Lelem._KeymanWebSelectionEnd;
      Lsel=DOMEventHandlers.states._Selection;

      this.keymanweb.uiManager.setActivatingUI(true);
      DOMEventHandlers.states._IgnoreNextSelChange = 100;
      this.keymanweb.domManager.focusLastActiveElement();
      
      if(Lelem instanceof HTMLIFrameElement && this.keymanweb.domManager._IsMozillaEditableIframe(Lelem,0)) {
        Lelem = (<any>Lelem).documentElement;  // I3363 (Build 301)
      }
      Lelem._KeymanWebSelectionStart=Ls;
      Lelem._KeymanWebSelectionEnd=Le;
      DOMEventHandlers.states._IgnoreNextSelChange = 0;
      if(Ptext!=null) {
        this.output(0, Lelem, Ptext);
      }
      if((typeof(PdeadKey)!=='undefined') && (PdeadKey !== null)) {
        this.deadkeyOutput(0, Lelem, PdeadKey);
      }
      Lelem._KeymanWebSelectionStart=null;
      Lelem._KeymanWebSelectionEnd=null;
      Lv=true;
    }
    //_DebugExit('InsertText');
    return Lv;
  }
  
  /**
   * Function     registerKeyboard  KR                    
   * Scope        Public
   * @param       {Object}      Pk      Keyboard  object
   * Description  Register and load the keyboard
   */    
  registerKeyboard(Pk): void {
    this.keymanweb.keyboardManager._registerKeyboard(Pk);
  }

  /**
   * Add the basic keyboard parameters (keyboard stub) to the array of keyboard stubs
   * If no language code is specified in a keyboard it cannot be registered, 
   * and a keyboard stub must be registered before the keyboard is loaded 
   * for the keyboard to be usable.
   * 
   * @param       {Object}      Pstub     Keyboard stub object
   * @return      {?number}               1 if already registered, else null
   */    
  registerStub(Pstub): number {
    return this.keymanweb.keyboardManager._registerStub(Pstub);
  }

  /**
   * Get *cached or uncached* keyboard context for a specified range, relative to caret
   * 
   * @param       {number}      n       Number of characters to move back from caret
   * @param       {number}      ln      Number of characters to return
   * @param       {Object}      Pelem   Element to work with (must be currently focused element)
   * @return      {string}              Context string 
   * 
   * Example     [abcdef|ghi] as INPUT, with the caret position marked by |:
   *             KC(2,1,Pelem) == "e"
   *             KC(3,3,Pelem) == "def"
   *             KC(10,10,Pelem) == "abcdef"  i.e. return as much as possible of the requested string
   */    
  
  context(n: number, ln:number, Pelem:HTMLElement): string {
    var v = this.cachedContext.get(n, ln);
    if(v !== null) {
      return v;
    }
    
    var r = this.keymanweb.KC_(n, ln, Pelem);
    this.cachedContext.set(n, ln, r);
    return r;
  }
  
  /**
   * Function     nul           KN    
   * Scope        Public
   * @param       {number}      n       Length of context to check
   * @param       {Object}      Ptarg   Element to work with (must be currently focused element)
   * @return      {boolean}             True if length of context is less than or equal to n
   * Description  Test length of context, return true if the length of the context is less than or equal to n
   * 
   * Example     [abc|def] as INPUT, with the caret position marked by |:
   *             KN(3,Pelem) == TRUE
   *             KN(2,Pelem) == FALSE
   *             KN(4,Pelem) == TRUE
   */    
  nul(n: number, Ptarg: HTMLElement): boolean {
    var cx=this.context(n+1, 1, Ptarg);
    
    // With #31, the result will be a replacement character if context is empty.
    return cx === "\uFFFE";
  }

  /**
   * Function     contextMatch  KCM   
   * Scope        Public
   * @param       {number}      n       Number of characters to move back from caret
   * @param       {Object}      Ptarg   Focused element
   * @param       {string}      val     String to match
   * @param       {number}      ln      Number of characters to return
   * @return      {boolean}             True if selected context matches val
   * Description  Test keyboard context for match
   */    
  contextMatch(n: number, Ptarg: HTMLElement, val: string, ln: number): boolean {
    //KeymanWeb._Debug('KeymanWeb.KCM(n='+n+', Ptarg, val='+val+', ln='+ln+'): return '+(kbdInterface.context(n,ln,Ptarg)==val)); 
    var cx=this.context(n, ln, Ptarg);
    if(cx === val) {
      return true; // I3318
    }
    this._DeadkeyResetMatched(); // I3318
    return false;
  }

  /**
   * Function     KIK      
   * Scope        Public
   * @param       {Object}  e   keystroke event
   * @return      {boolean}     true if keypress event
   * Description  Test if event as a keypress event
   */    
  isKeypress(e: KeyEvent):boolean {
    if(this.keymanweb.keyboardManager.activeKeyboard['KM']) {   // I1380 - support KIK for positional layouts
      return !e.LisVirtualKey;             // will now return true for U_xxxx keys, but not for T_xxxx keys
    } else {
      return this.keymanweb.keyMapManager._USKeyCodeToCharCode(e) ? true : false; // I1380 - support KIK for positional layouts
    }
  }
  
  /**
   * Function     keyMatch      KKM      
   * Scope        Public
   * @param       {Object}      e           keystroke event
   * @param       {number}      Lruleshift
   * @param       {number}      Lrulekey
   * @return      {boolean}                 True if key matches rule
   * Description  Test keystroke with modifiers against rule
   */    
  keyMatch(e: KeyEvent, Lruleshift:number, Lrulekey:number): boolean {
    var retVal = false; // I3318
    var keyCode = (e.Lcode == 173 ? 189 : e.Lcode);  //I3555 (Firefox hyphen issue)

    var bitmask = this.keymanweb.keyboardManager.getKeyboardModifierBitmask();

    if(e.vkCode > 255) {
      keyCode = e.vkCode; // added to support extended (touch-hold) keys for mnemonic layouts
    }
      
    if(e.LisVirtualKey || keyCode > 255) {
      if((Lruleshift & 0x4000) == 0x4000 || (keyCode > 255)) { // added keyCode test to support extended keys
        retVal = ((Lrulekey == keyCode) && ((Lruleshift & bitmask) == e.Lmodifiers)); //I3318, I3555
      }
    } else if((Lruleshift & 0x4000) == 0) {
      retVal = (keyCode == Lrulekey); // I3318, I3555
    }
    if(!retVal) {
      this._DeadkeyResetMatched();  // I3318
    }
    return retVal; // I3318
  };

  /**
   * Function     stateMatch    KSM
   * Scope        Public
   * @param       {Object}      e       keystroke event
   * @param       {number}      Lstate  
   * Description  Test keystroke against state key rules
   */
  stateMatch(e: KeyEvent, Lstate: number) {
    return ((Lstate & e.Lstates) == Lstate);
  }

  /**
   * Function     keyInformation  KKI
   * Scope        Public
   * @param       {Object}      e
   * @return      {Object}              Object with event's virtual key flag, key code, and modifiers
   * Description  Get object with extended key event information
   */    
  keyInformation(e: KeyEvent): KeyInformation {
    var ei = new KeyInformation();
    ei['vk'] = e.LisVirtualKey;
    ei['code'] = e.Lcode;
    ei['modifiers'] = e.Lmodifiers;
    return ei;
  };
  
  /**
   * Function     deadkeyMatch  KDM      
   * Scope        Public
   * @param       {number}      n       current cursor position
   * @param       {Object}      Ptarg   target element
   * @param       {number}      d       deadkey
   * @return      {boolean}             True if deadkey found selected context matches val
   * Description  Match deadkey at current cursor position
   */    
  deadkeyMatch(n: number, Ptarg: HTMLElement, d: number): boolean {
    if(this._DeadKeys.length == 0) {
      return false; // I3318
    }

    var sp=this._SelPos(Ptarg);
    n = sp - n;
    for(var i = 0; i < this._DeadKeys.length; i++) {
      if(this._DeadKeys[i].match(n, d)) {
        this._DeadKeys[i].set();
        return true; // I3318
      }
    }
    this._DeadkeyResetMatched(); // I3318

    return false;
  }
  
  /**
   * Function     beepReset   KBR      
   * Scope        Public
   * Description  Reset/terminate beep or flash (not currently used: Aug 2011)
   */    
  beepReset(): void {
    this.resetContextCache();

    var Lbo;
    this._BeepTimeout = 0;
    for(Lbo=0;Lbo<this._BeepObjects.length;Lbo++) { // I1511 - array prototype extended
      this._BeepObjects[Lbo].reset();
    }
    this._BeepObjects = [];
  }
    
  /**
   * Function     beep          KB      
   * Scope        Public
   * @param       {Object}      Pelem     element to flash
   * Description  Flash body as substitute for audible beep
   */    
  beep(Pelem: HTMLElement|Document): void {
    this.resetContextCache();
    
    if(Pelem instanceof Document) {
      Pelem=Pelem.body; // I1446 - beep sometimes fails to flash when using OSK and rich control
    }
    
    if(!Pelem.style || typeof(Pelem.style.backgroundColor)=='undefined') {
      return;
    }

    for(var Lbo=0; Lbo<this._BeepObjects.length; Lbo++) { // I1446 - beep sometimes fails to return background color to normal
                                                                // I1511 - array prototype extended
      if(this._BeepObjects[Lbo].e == Pelem) {
        return;
      }
    }
    
    this._BeepObjects = this.keymanweb._push(this._BeepObjects, new BeepData(Pelem));
    Pelem.style.backgroundColor = '#000000';
    if(this._BeepTimeout == 0) {
      this._BeepTimeout = 1;
      window.setTimeout(this.beepReset.bind(this), 50);
    }
  }
  
  /**
   * Function     any           KA      
   * Scope        Public
   * @param       {number}      n     character position (index) 
   * @param       {string}      ch    character to find in string
   * @param       {string}      s     'any' string   
   * @return      {boolean}           True if character found in 'any' string, sets index accordingly
   * Description  Test for character matching
   */    
  any(n: number, ch: string, s:string): boolean {
    if(ch == '') {
      return false;
    }
    var Lix = s._kmwIndexOf(ch); //I3319
    this._AnyIndices[n] = Lix;
    return Lix >= 0;
  }
  
  /**
   * Function     output        KO  
   * Scope        Public
   * @param       {number}      dn      number of characters to overwrite
   * @param       {Object}      Pelem   element to output to 
   * @param       {string}      s       string to output   
   * Description  Keyboard output
   */    
  output(dn: number, Pelem, s:string): void {
    this.resetContextCache();
    
    // KeymanTouch for Android uses direct insertion of the character string
    if('oninserttext' in this.keymanweb) {
      this.keymanweb['oninserttext'](dn,s);
    }

    if(Pelem.body) {
      var Ldoc=Pelem;
    } else {
      var Ldoc=Pelem.ownerDocument;	// I1481 - integration with rich editors not working 100%
    }
    var Li, Ldv;
  
    if(Pelem.className.indexOf('keymanweb-input') >= 0) {
      var t=this.keymanweb.touchAliasing.getTextBeforeCaret(Pelem);
      if(dn > 0) {
        t=t._kmwSubstr(0,t._kmwLength()-dn)+s; 
      } else {
        t=t+s;
      }
      
      this.keymanweb.touchAliasing.setTextBeforeCaret(Pelem,t);
      return;
    }
  
    if (Ldoc  &&  (Ldv=Ldoc.defaultView)  &&  Ldv.getSelection  &&  
        (Ldoc.designMode.toLowerCase() == 'on' || Pelem.contentEditable == 'true' || Pelem.contentEditable == 'plaintext-only' || Pelem.contentEditable === '')      
      ) { // I2457 - support contentEditable elements in mozilla, webkit
      /* Editable iframe and contentEditable elements for mozilla */
      var _IsEditableIframe = Ldoc.designMode.toLowerCase() == 'on';
      if(_IsEditableIframe) {
        var _CacheableCommands = this._CacheCommands(Ldoc);
      }
    
      var Lsel = Ldv.getSelection();
      var LselectionStart = Lsel.focusNode.nodeValue ? Lsel.focusNode.substringData(0,Lsel.focusOffset)._kmwLength() : 0;  // I3319
      
      if(!Lsel.isCollapsed) {
        Lsel.deleteFromDocument();  // I2134, I2192
      }
      //KeymanWeb._Debug('KO: focusOffset='+Lsel.focusOffset+', dn='+dn+', s='+s+' focusNode.type='+Lsel.focusNode.nodeType+', focusNode.parentNode.tagName='+(Lsel.focusNode.parentNode?Lsel.focusNode.parentNode.tagName:'NULL') );

      var Lrange = Lsel.getRangeAt(0);
      if(dn > 0) {
        Lrange.setStart(Lsel.focusNode, Lsel.focusOffset - Lsel.focusNode.nodeValue.substr(0,Lsel.focusOffset)._kmwSubstr(-dn).length); // I3319
        Lrange.deleteContents();
      }

      //KeymanWeb._Debug('KO: focusOffset='+Lsel.focusOffset+', dn='+dn+', s='+s+' focusNode.type='+Lsel.focusNode.nodeType+', focusNode.parentNode.tagName='+(Lsel.focusNode.parentNode?Lsel.focusNode.parentNode.tagName:'NULL') );

      if(s._kmwLength() > 0) { // I2132 - exception if s.length > 0, I3319
        if(Lsel.focusNode.nodeType == 3) {
          // I2134, I2192
          // Already in a text node
          //KeymanWeb._Debug('KO: Already in a text node, adding "'+s+'": '+Lsel.focusOffset + '-> '+Lsel.toString());
          var LfocusOffset = Lsel.focusOffset;
          //KeymanWeb._Debug('KO: node.text="'+Lsel.focusNode.data+'", node.length='+Lsel.focusNode.length);
          Lsel.focusNode.insertData(Lsel.focusOffset, s);
          try {
            Lsel.extend(Lsel.focusNode, LfocusOffset + s.length); 
          } catch(e) {
            // Chrome (through 4.0 at least) throws an exception because it has not synchronised its content with the selection.  scrollIntoView synchronises the content for selection
            Lsel.focusNode.parentNode.scrollIntoView();
            Lsel.extend(Lsel.focusNode, LfocusOffset + s.length);
          }
        } else {
          // Create a new text node - empty control
          //KeymanWeb._Debug('KO: Creating a new text node for "'+s+'"');
          var n = Ldoc.createTextNode(s);
          Lrange.insertNode(n);
          Lsel.extend(n,s.length);
        }
      }

      if(_IsEditableIframe) {
        this._CacheCommandsReset(Ldoc, _CacheableCommands, null);// I2457 - support contentEditable elements in mozilla, webkit
      }
      
      Lsel.collapseToEnd();

      // Adjust deadkey positions 
      if(dn >= 0) {
        this._DeadkeyDeleteMatched();                                  // I3318
        this._DeadkeyAdjustPos(LselectionStart, -dn + s._kmwLength()); // I3318
      } // Internet Explorer   (including IE9)   
    } else if(Ldoc  &&  (Ldv=Ldoc.selection)) { // build 77 - use elem.ownerDocument.selection
      if(Ldoc.body.isContentEditable || Ldoc.designMode.toLowerCase()=='on') { // I1295 - isContentEditable
        var _CacheableCommands = this._CacheCommands(Ldoc);
      }

      var Lrange = Ldv.createRange(), Ls1;
      if(Lrange.text != '') {
        Ldv.clear();
        dn = 0;
      } else {
        Lrange.collapse(true);
      }

      if(dn > 0) {              
        Lrange.moveStart('character',-2*dn);  // I3319 (next four lines
        var s0=Lrange.text,s1=s0._kmwSubstr(-dn);
        Lrange.collapse(false); //move start back to end
        Lrange.moveStart('character',-s1.length);
      } else {
        dn = 0;
      }

      Lrange.text = s;

      if(Ldoc.body.isContentEditable || Ldoc.designMode.toLowerCase()=='on') { // I1295 - isContentEditable
        Lrange.moveStart('character',-s.length);
        
        this._CacheCommandsReset(Ldoc, _CacheableCommands,Lrange.select);
        Lrange.moveStart('character',s.length);
        Lrange.select();
      }
      // Adjust deadkey positions 
      if(dn >= 0) {
        // Pelem.selectionStart seems to exist here in IE 9 and is valid.  This provides a possible approach, but may be wrong.
        // It appears safe to model the deadkey adjustment based on the non-IE9 code path's calculations.
        if(Pelem._KeymanWebSelectionStart != null) {// changed to allow a value of 0
          LselectionStart = Pelem._KeymanWebSelectionStart;
        } else {
          LselectionStart = Pelem.value._kmwCodeUnitToCodePoint(Pelem.selectionStart);  // I3319
        }

        this._DeadkeyDeleteMatched();                                  // I3318
        this._DeadkeyAdjustPos(LselectionStart, -dn + s._kmwLength()); // I3318
      }

      DOMEventHandlers.states._Selection = Ldv.createRange();
      DOMEventHandlers.states._Selection.select();
      DOMEventHandlers.states._Selection.scrollIntoView();
      // Mozilla et al; IE9+ also recognizes setSelectionRange, but does not seem to work in exactly the same way as Mozilla
    } else if (Pelem.setSelectionRange) {                                        
      var LselectionStart, LselectionEnd;
            
      if(Pelem._KeymanWebSelectionStart != null) {// changed to allow a value of 0
        LselectionStart = Pelem._KeymanWebSelectionStart;
        LselectionEnd = Pelem._KeymanWebSelectionEnd;
      } else {
        LselectionStart = Pelem.value._kmwCodeUnitToCodePoint(Pelem.selectionStart);  // I3319
        LselectionEnd = Pelem.value._kmwCodeUnitToCodePoint(Pelem.selectionEnd);      // I3319
      }
      
      var LscrollTop, LscrollLeft;
      if(Pelem.type.toLowerCase() == 'textarea' && typeof(Pelem.scrollTop) != 'undefined') {
        LscrollTop = Pelem.scrollTop; LscrollLeft = Pelem.scrollLeft;
      }

      if(dn < 0) {// Don't delete, leave context alone (dn = -1)
        Pelem.value = Pelem.value._kmwSubstring(0,LselectionStart) + s + Pelem.value._kmwSubstring(LselectionEnd);    //I3319
        dn = 0;
      } else if(LselectionStart < dn) {
        Pelem.value = s + Pelem.value._kmwSubstring(LselectionEnd); //I3319
      } else {
        Pelem.value = Pelem.value._kmwSubstring(0,LselectionStart-dn) + s + Pelem.value._kmwSubstring(LselectionEnd); //I3319
      }

      // Adjust deadkey positions 
      if(dn >= 0) {
        this._DeadkeyDeleteMatched(); // I3318
        this._DeadkeyAdjustPos(LselectionStart, -dn + s._kmwLength()); // I3318,I3319
      }

      if (typeof(LscrollTop) != 'undefined') {
        Pelem.scrollTop = LscrollTop;
        Pelem.scrollLeft = LscrollLeft;
      } 
      var caretPos=LselectionStart-dn+s._kmwLength();                   // I3319
      var caretPosUnits=Pelem.value._kmwCodePointToCodeUnit(caretPos);  // I3319
      
      Pelem.setSelectionRange(caretPosUnits,caretPosUnits);             // I3319
      Pelem._KeymanWebSelectionStart = null; Pelem._KeymanWebSelectionEnd = null;      
    }

    // Refresh element content after change (if needed)
    if(typeof(this.keymanweb.refreshElementContent) == 'function') {
      this.keymanweb.refreshElementContent(Pelem);
    }
  }
  
  /**
   * Function     deadkeyOutput KDO      
   * Scope        Public
   * @param       {number}      Pdn     no of character to overwrite (delete) 
   * @param       {Object}      Pelem   element to output to 
   * @param       {number}      Pd      deadkey id
   * Description  Record a deadkey at current cursor position, deleting Pdn characters first
   */    
  deadkeyOutput(Pdn: number, Pelem: HTMLElement, Pd: number): void {
    this.resetContextCache();

    if(Pdn >= 0) {
      this.output(Pdn,Pelem,"");  //I3318 corrected to >=
    }

    var Lc: Deadkey = new Deadkey(this._SelPos(Pelem), Pd);

    this._DeadKeys=this.keymanweb._push(this._DeadKeys,Lc);      
    //    _DebugDeadKeys(Pelem, 'KDeadKeyOutput: dn='+Pdn+'; deadKey='+Pd);
  }

  /**
   * Function     indexOutput   KIO      
   * Scope        Public
   * @param       {number}      Pdn     no of character to overwrite (delete) 
   * @param       {string}      Ps      string
   * @param       {number}      Pn      index
   * @param       {Object}      Pelem   element to output to 
   * Description  Output a character selected from the string according to the offset in the index array
   */    
  indexOutput(Pdn: number, Ps: string, Pn: number, Pelem: HTMLElement): void {
    this.resetContextCache();
    if(this._AnyIndices[Pn-1] < Ps._kmwLength()) {                        //I3319
      this.output(Pdn,Pelem,Ps._kmwCharAt(this._AnyIndices[Pn-1]));  //I3319
    }
  }

  /**
   * Function     _CacheCommands
   * Scope        Private
   * @param       {Object}    _Document
   * @return      {Array.<string>}        List of style commands that are cacheable
   * Description  Build reate list of styles that can be applied in iframes
   */    
  private _CacheCommands = function(_Document: Document): StyleCommand[] { // I1204 - style application in IFRAMEs, I2192, I2134, I2192   
    //var _CacheableBackColor=(_Document.selection?'hilitecolor':'backcolor');

    var _CacheableCommands=[
      new StyleCommand('backcolor',1), new StyleCommand('fontname',1), new StyleCommand('fontsize',1), 
      new StyleCommand('forecolor',1), new StyleCommand('bold',0), new StyleCommand('italic',0), 
      new StyleCommand('strikethrough',0), new StyleCommand('subscript',0),
      new StyleCommand('superscript',0), new StyleCommand('underline',0)
    ];
    if(_Document.defaultView) {
      this.keymanweb._push(_CacheableCommands,['hilitecolor',1]);
    }
      
    for(var n=0;n < _CacheableCommands.length; n++) { // I1511 - array prototype extended
      //KeymanWeb._Debug('Command:'+_CacheableCommands[n][0]);
      this.keymanweb._push(_CacheableCommands[n], _CacheableCommands[n][1] ?
          _Document.queryCommandValue(_CacheableCommands[n][0]) :
          _Document.queryCommandState(_CacheableCommands[n][0]));
    }
    return _CacheableCommands;
  }
  
  /**
   * Function     _CacheCommandReset
   * Scope        Private
   * @param       {Object} _Document
   *             _CacheableCommands
   *             _func      
   * Description  Restore styles in IFRAMEs (??)
   */    
  private _CacheCommandsReset = function(_Document: HTMLDocument, _CacheableCommands: StyleCommand[], _func: () => void): void {
    for(var n=0;n < _CacheableCommands.length; n++) { // I1511 - array prototype extended
      //KeymanWeb._Debug('ResetCacheCommand:'+_CacheableCommands[n][0]+'='+_CacheableCommands[n][2]);
      if(_CacheableCommands[n][1]) {
        if(_Document.queryCommandValue(_CacheableCommands[n][0]) != _CacheableCommands[n][2]) {
          if(_func) {
            _func();
          }
          _Document.execCommand(_CacheableCommands[n][0], false, _CacheableCommands[n][2]);
        }
      } else if(_Document.queryCommandState(_CacheableCommands[n][0]) != _CacheableCommands[n][2]) {
        if(_func) {
          _func();
        }
        //KeymanWeb._Debug('executing command '+_CacheableCommand[n][0]);
        _Document.execCommand(_CacheableCommands[n][0], false, null);
      }
    }
  }
  
  /**
   * KIFS compares the content of a system store with a string value 
   * 
   * @param       {number}      systemId    ID of the system store to test (only TSS_LAYER currently supported)
   * @param       {string}      strValue    String value to compare to
   * @param       {Object}      Pelem       Currently active element (may be needed by future tests)     
   * @return      {boolean}                 True if the test succeeds 
   */       
  ifStore(systemId: number, strValue: string, Pelem: HTMLElement): boolean {
    var result=true;
    if(systemId == this.TSS_LAYER) {
      result = (this.keymanweb.osk.layerId === strValue);
    } else if(systemId == this.TSS_PLATFORM) {
      var i,constraint,constraints=strValue.split(' ');
      for(i=0; i<constraints.length; i++) {
        constraint=constraints[i].toLowerCase();
        switch(constraint) {
          case 'touch':
          case 'hardware':
            if(this.keymanweb.util.activeDevice.touchable != (constraint == 'touch')) {
              result=false;
            }
        }

        switch(constraint) {
          case 'windows':
          case 'android':
          case 'ios':
          case 'macosx':
          case 'linux':
            if(this.keymanweb.util.activeDevice.OS.toLowerCase() != constraint) {
              result=false;
            }
        }

        switch(constraint) {
          case 'tablet':
          case 'phone':
          case 'desktop':
            if(this.keymanweb.util.activeDevice.formFactor != constraint) {
              result=false;
            }
        }

        switch(constraint) {
          case 'web':
            if(this.keymanweb.util.activeDevice.browser == 'native') {
              result=false; // web matches anything other than 'native'
            }
            break;
          case 'native':
          case 'ie':
          case 'chrome':
          case 'firefox':
          case 'safari':
          case 'opera':
            if(this.keymanweb.util.activeDevice.browser != constraint) {
              result=false;
            }
        }
      }
    }
    return result; //Moved from previous line, now supports layer selection, Build 350 
  }

  /**
   * KSETS sets the value of a system store to a string  
   * 
   * @param       {number}      systemId    ID of the system store to set (only TSS_LAYER currently supported)
   * @param       {string}      strValue    String to set as the system store content 
   * @param       {Object}      Pelem       Currently active element (may be needed in future tests)     
   * @return      {boolean}                 True if command succeeds
   *                                        (i.e. for TSS_LAYER, if the layer is successfully selected)
   */    
  setStore(systemId: number, strValue: string, Pelem: HTMLElement): boolean {
    this.resetContextCache();
    if(systemId == this.TSS_LAYER) {
      return this.keymanweb.osk.showLayer(strValue);     //Buld 350, osk reference now OK, so should work
    } else {
      return false;
    }
  }

  /**
   * Load an option store value from a cookie or default value
   * 
   * @param       {string}      kbdName     keyboard internal name
   * @param       {string}      storeName   store (option) name, embedded in cookie name
   * @param       {string}      dfltValue   default value
   * @return      {string}                  current or default option value   
   */    
  loadStore(kbdName: string, storeName:string, dfltValue:string): string {
    this.resetContextCache();
    var cName='KeymanWeb_'+kbdName+'_Option_'+storeName,cValue=this.keymanweb.util.loadCookie(cName);
    if(typeof cValue[storeName] != 'undefined') {
      return decodeURI(cValue[storeName]);
    } else {
      return dfltValue;
    }
  }

  /**
   * Save an option store value to a cookie 
   * 
   * @param       {string}      storeName   store (option) name, embedded in cookie name
   * @param       {string}      optValue    option value to save
   * @return      {boolean}                 true if save successful
   */    
  saveStore(storeName:string, optValue:string): boolean {
    this.resetContextCache();
    var kbd=this.keymanweb.keyboardManager.activeKeyboard;
    if(!kbd || typeof kbd['KI'] == 'undefined' || kbd['KI'] == '') {
      return false;
    }
    
    var cName='KeymanWeb_'+kbd['KI']+'_Option_'+storeName, cValue=encodeURI(optValue);

    this.keymanweb.util.saveCookie(cName,cValue);
    return true;
  }

  resetContextCache(): void {
    this.cachedContext.reset();
  }
  
  // I3318 - deadkey changes START
  /**
   * Function     _DeadkeyResetMatched
   * Scope        Private
   * Description  Clear all matched deadkey flags
   */       
  _DeadkeyResetMatched(): void {                   
    var Li, _Dk = this._DeadKeys;
    for(Li = 0; Li < _Dk.length; Li++) {
      (<Deadkey>_Dk[Li]).reset();
    }
  }

  /**
   * Function     _DeadkeyDeleteMatched
   * Scope        Private
   * Description  Delete matched deadkeys from context
   */       
  _DeadkeyDeleteMatched(): void {              
    var Li, _Dk = this._DeadKeys;
    for(Li = 0; Li < _Dk.length; Li++) {
      if(_Dk[Li].matched) {
        _Dk.splice(Li,1);
      }
    }
  }

  /**
   * Function     _DeadkeyAdjustPos
   * Scope        Private
   * @param       {number}      Lstart      start position in context
   * @param       {number}      Ldelta      characters to adjust by   
   * Description  Adjust saved positions of deadkeys in context
   */       
  _DeadkeyAdjustPos(Lstart: number, Ldelta: number): void {
    var Li, _Dk = this._DeadKeys;
    for(Li = 0; Li < _Dk.length; Li++) {
      if(_Dk[Li].p > Lstart) {
        _Dk[Li].p += Ldelta;
      }
    }
  }

  clearDeadkeys = function(): void {
    this._DeadKeys = [];
  }
  // I3318 - deadkey changes END

  /**
   * Function     processKeystroke
   * Scope        Private
   * @param       {Object}        device      The device object properties to be utilized for this keystroke.
   * @param       {Object}        element     The page element receiving input
   * @param       {Object}        keystroke   The input keystroke (with its properties) to be mapped by the keyboard.
   * Description  Encapsulates calls to keyboard input processing.
   * @returns     {number}        0 if no match is made, otherwise 1.
   */
  processKeystroke(device, element: HTMLElement, keystroke:KeyEvent|LegacyKeyEvent) {
    // Clear internal state tracking data from prior keystrokes.
    (<any>this.keymanweb)._CachedSelectionStart = null; // I3319     
    this._DeadkeyResetMatched();       // I3318    
    this.resetContextCache();

    // Ensure the settings are in place so that KIFS/ifState activates and deactivates
    // the appropriate rule(s) for the modeled device.
    this.keymanweb.util.activeDevice = device;

    // Calls the start-group of the active keyboard.
    return this.keymanweb.keyboardManager.activeKeyboard['gs'](element, keystroke);
  }
  
  /**
   * Legacy entry points (non-standard names)- included only to allow existing IME keyboards to continue to be used
   */
  ['getLastActiveElement'](): HTMLElement {
    return this.keymanweb.domManager.getLastActiveElement(); 
  }

  ['focusLastActiveElement'](): void { 
    this.keymanweb.domManager.focusLastActiveElement(); 
  }

  //The following entry points are defined but should not normally be used in a keyboard, as OSK display is no longer determined by the keyboard
  ['hideHelp'](): void {
    this.keymanweb.osk._Hide(true);
  }

  ['showHelp'](Px: number, Py: number): void {
    this.keymanweb.osk._Show(Px,Py);
  }

  ['showPinnedHelp'](): void {
    this.keymanweb.osk.userPositioned=true; 
    this.keymanweb.osk._Show(-1,-1);
  }

  resetContext() {
    this.keymanweb.osk.layerId = 'default';

    this.clearDeadkeys();
    this.resetContextCache();
    this.resetVKShift();

    this.keymanweb.osk._Show();
  };

  /**
   * Function     _SelPos
   * Scope        Private
   * @param       {Object}  Pelem   Element
   * @return      {number}          Selection start
   * Description  Get start of selection (with supplementary plane modifications)
   */   
  _SelPos(Pelem: HTMLElement) {
    var Ldoc, Ldv, isMSIE=(this.keymanweb.util._GetIEVersion()<999); // I3363 (Build 301)

    if((<any>this.keymanweb).isPositionSynthesized())
      return this.keymanweb.touchAliasing.getTextCaret(Pelem);

    if(Pelem._KeymanWebSelectionStart) 
      return Pelem._KeymanWebSelectionStart;
    
    // Mozilla, IE9 
    else if ((Pelem instanceof HTMLInputElement || Pelem instanceof HTMLTextAreaElement) && Pelem.setSelectionRange)  
      return Pelem.value.substr(0,Pelem.selectionStart)._kmwLength();        
  
    // contentEditable elements, Mozilla midas
    else if((Ldv=Pelem.ownerDocument)  &&  (Ldv=Ldv.defaultView)  &&  Ldv.getSelection
      &&  Pelem.ownerDocument.designMode.toLowerCase() == 'on') {
      var Lsel = Ldv.getSelection();
      if(Lsel.focusNode.nodeType == 3) 
        return Lsel.focusNode.substringData(0,Lsel.focusOffset)._kmwLength(); 
    }
    
    return 0;
  }

  /**
   * Reset OSK shift states when entering or exiting the active element
   **/    
  resetVKShift() {
    if(!this.keymanweb.uiManager.isActivating) 
    {
      if(this.keymanweb.osk._UpdateVKShift) {
        this.keymanweb.osk._UpdateVKShift(null,15,0);  //this should be enabled !!!!! TODO
      }
    }
  }
}
