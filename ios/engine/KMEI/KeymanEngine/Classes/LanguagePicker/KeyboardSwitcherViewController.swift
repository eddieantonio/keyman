//
//  KeyboardSwitcherViewControllerTableViewController.swift
//  KeymanEngine
//
//  Created by Randy Boring on 7/26/19.
//  Copyright © 2019 SIL International. All rights reserved.
//
// This subclass is slimmed down to *just* picking (switching to) an existing keyboard.
// It replaces the original in every case but one.

import UIKit

private let toolbarButtonTag = 100

class KeyboardSwitcherViewController: UITableViewController, UIAlertViewDelegate {
  private var userKeyboards: [InstallableKeyboard] = [InstallableKeyboard]()
  public var accessoryType: UITableViewCellAccessoryType = .none

  override func viewDidLoad() {
    super.viewDidLoad()
    
    title = "Keyboards"
    
    self.accessoryType = .none
    
    // remove UI that adds keyboards
    //NEEDED?
    navigationItem.rightBarButtonItem = nil
    
    log.info("didLoad: KeyboardSwitcherViewController")
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    
    loadUserKeyboards()
    scroll(toSelectedKeyboard: false)
  }
  
  private func scroll(toSelectedKeyboard animated: Bool) {
    let index = userKeyboards.index { kb in
      return Manager.shared.currentKeyboardID == kb.fullID
    }
    
    if let index = index {
      let indexPath = IndexPath(row: index, section: 0)
      tableView.scrollToRow(at: indexPath, at: .middle, animated: animated)
      
    }
  }
  
  // MARK: - Table view data source UITableViewDataSource
  
  override func numberOfSections(in tableView: UITableView) -> Int {
    return 1
  }
  
  // MARK: - table view delegate UITableViewDelegate

  override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    return userKeyboards.count
  }
  
  override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cellIdentifier = "Cell"
    if let cell = tableView.dequeueReusableCell(withIdentifier: cellIdentifier) {
      return cell
    }
    
    let cell = UITableViewCell(style: .subtitle, reuseIdentifier: cellIdentifier)
    let selectionColor = UIView()
    selectionColor.backgroundColor = UIColor(red: 204.0 / 255.0, green: 136.0 / 255.0, blue: 34.0 / 255.0, alpha: 1.0)
    cell.selectedBackgroundView = selectionColor
    return cell
  }
  
  override func tableView(_ tableView: UITableView,
                          willDisplay cell: UITableViewCell,
                          forRowAt indexPath: IndexPath) {
    cell.selectionStyle = .none
    let kb = userKeyboards[indexPath.row]
    
    cell.textLabel?.text = kb.languageName
    cell.detailTextLabel?.text = kb.name
    cell.tag = indexPath.row
    
    if Manager.shared.currentKeyboardID == kb.fullID {
      cell.selectionStyle = .blue
      cell.isSelected = true
      cell.accessoryType = self.accessoryType
    } else {
      cell.selectionStyle = .none
      cell.isSelected = false
      cell.accessoryType = self.accessoryType
    }
  }
  
  override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    switchKeyboard(indexPath.row)
  }
  
  // MARK: - keyboard switching
  
  public func switchKeyboard(_ index: Int) {
    // Switch keyboard and register to user defaults.
    if Manager.shared.setKeyboard(userKeyboards[index]) {
      tableView.reloadData()
    }
    
    Manager.shared.dismissKeyboardPicker(self)
  }
  
  private func loadUserKeyboards() {
    userKeyboards = Storage.active.userDefaults.userKeyboards ?? []
    tableView.reloadData()
  }
}
