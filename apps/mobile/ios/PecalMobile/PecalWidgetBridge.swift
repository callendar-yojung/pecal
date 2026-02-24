import Foundation
import WidgetKit
import React

@objc(PecalWidgetBridge)
class PecalWidgetBridge: NSObject {
  private let suiteName = "group.site.pecal.app"
  private let storageKey = "pecal_widget_payload"

  @objc
  func setWidgetData(_ jsonPayload: String,
                     resolver resolve: RCTPromiseResolveBlock,
                     rejecter reject: RCTPromiseRejectBlock) {
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      reject("E_APP_GROUP", "App Group UserDefaults init failed", nil)
      return
    }
    defaults.set(jsonPayload, forKey: storageKey)
    defaults.synchronize()
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }

  @objc
  func clearWidgetData(_ resolve: RCTPromiseResolveBlock,
                       rejecter reject: RCTPromiseRejectBlock) {
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      reject("E_APP_GROUP", "App Group UserDefaults init failed", nil)
      return
    }
    defaults.removeObject(forKey: storageKey)
    defaults.synchronize()
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }

  @objc
  func reloadAllTimelines(_ resolve: RCTPromiseResolveBlock,
                          rejecter reject: RCTPromiseRejectBlock) {
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool { false }
}
