//
//  FVInputViewController.swift
//  SWKeyboard
//
//  Created by Marc Durdin on 14/5/19.
//  Copyright © 2019 FirstVoices. All rights reserved.
//

//import Foundation
import KeymanEngine
import UIKit

@objc(FVInputViewController)
class FVInputViewController: InputViewController {
  override init(nibName nibNameOrNil: String?, bundle nibBundleOrNil: Bundle?) {
    //#if DEBUG
      KeymanEngine.log.outputLevel = .debug
      KeymanEngine.log.logAppDetails()
    //#else
    //  KeymanEngine.log.outputLevel = .warning
    //#endif

    Manager.applicationGroupIdentifier = FVConstants.groupID

    super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)

    self.globeKeyTapBehaviour = .switchToNextKeyboard
    self.menuBehaviour = .showAlways
    self.menuCloseButtonTitle = "Switch to other keyboard"
  }

  required init?(coder aDecoder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func updateViewConstraints() {
    super.updateViewConstraints()

    if view.frame.size.width == 0 || self.view.frame.size.height == 0 {
      return
    }

    setupTopBarImage(isPortrait: InputViewController.isPortrait)
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    setupTopBarImage(isPortrait: InputViewController.isPortrait)
  }

  override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
    super.viewWillTransition(to: size, with: coordinator)
    setupTopBarImage(isPortrait: UIDevice.current.orientation.isPortrait)
  }

  func getTopBarImage(isPortrait: Bool) -> String? {
    if isPortrait {
      return Bundle.main.path(forResource: "banner-Portrait@2x", ofType: "png")
    }

    // iPad
    if UIDevice.current.userInterfaceIdiom != UIUserInterfaceIdiom.phone {
      return Bundle.main.path(forResource: "banner-Landscape@2x", ofType: "png")
    }

    // iPhone
    let screenRect = UIScreen.main.bounds
    if CGFloat.maximum(screenRect.height, screenRect.width) >= 568.0 {
      return Bundle.main.path(forResource: "banner-Landscape-568h@2x", ofType: "png")
    } else {
      return Bundle.main.path(forResource: "banner-Landscape@2x", ofType: "png")
    }
  }

  func setupTopBarImage(isPortrait: Bool) {
    let imgPath = getTopBarImage(isPortrait: isPortrait)
    guard let path = imgPath else {
      log.error("No image specified for the image banner!")
      return
    }

    self.setBannerImage(to: path)
  }
}

