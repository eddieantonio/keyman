//
//  KMInputMethodBrowserClientEventHandlerProtected.h
//  Keyman4MacIM
//
//  Created by tom on 1/9/18.
//  Copyright © 2018 SIL International. All rights reserved.
//

#ifndef KMInputMethodEventBrowserClientHandlerProtected_h
#define KMInputMethodEventBrowserClientHandlerProtected_h

@interface KMInputMethodBrowserClientEventHandler ()

@property (assign) BOOL couldBeInGoogleDocs;

- (void)setInSiteThatDoesNotGiveContext;

@end

#endif /* KMInputMethodEventBrowserClientHandlerProtected_h */
