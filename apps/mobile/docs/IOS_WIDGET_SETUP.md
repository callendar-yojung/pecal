# iOS Widget Setup (Expo + React Native)

이 문서는 `apps/mobile`에서 홈 위젯을 붙이는 최소 작업 순서입니다.

## 1) Expo에서 iOS 프로젝트 생성

```bash
cd /Users/jangsajang/WebstormProjects/pecal/apps/mobile
npx expo prebuild -p ios
```

생성 후 `ios/` 폴더가 생깁니다.

## 2) Xcode에서 Widget Extension 추가

1. `ios/*.xcworkspace` 열기
2. `File > New > Target`
3. `Widget Extension` 선택
4. 이름 예시: `PecalWidgetExtension`
5. Live Activity는 필요 없으면 체크 해제

## 3) App Group 설정 > 이거부터 내일 하기

앱 타깃 + 위젯 타깃 둘 다 동일한 App Group 사용:

- 예: `group.site.pecal.app`

Xcode 경로:

- `TARGETS > (App Target) > Signing & Capabilities > + Capability > App Groups`
- `TARGETS > (Widget Target) > Signing & Capabilities > + Capability > App Groups`

## 4) 앱 타깃에 RN 브리지 추가

앱 타깃(메인 앱)에 Swift 파일 `PecalWidgetBridge.swift` 추가:

```swift
import Foundation
import WidgetKit

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
```

브리지 노출용 `PecalWidgetBridge.m` 파일도 앱 타깃에 추가:

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PecalWidgetBridge, NSObject)

RCT_EXTERN_METHOD(setWidgetData:(NSString *)jsonPayload
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearWidgetData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reloadAllTimelines:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
```

## 5) 위젯 타깃 코드 예시

Widget extension에 기본 파일을 아래처럼 구성:

```swift
import WidgetKit
import SwiftUI

struct PecalWidgetTask: Decodable {
  let id: Int
  let title: String
  let start_time: String
  let end_time: String
  let status: String
  let color: String
}

struct PecalWidgetPayload: Decodable {
  let generated_at: String
  let workspace_name: String
  let nickname: String
  let tasks: [PecalWidgetTask]
}

struct PecalWidgetEntry: TimelineEntry {
  let date: Date
  let payload: PecalWidgetPayload?
}

struct PecalWidgetProvider: TimelineProvider {
  private let suiteName = "group.site.pecal.app"
  private let storageKey = "pecal_widget_payload"

  func placeholder(in context: Context) -> PecalWidgetEntry {
    PecalWidgetEntry(date: .now, payload: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (PecalWidgetEntry) -> Void) {
    completion(PecalWidgetEntry(date: .now, payload: loadPayload()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<PecalWidgetEntry>) -> Void) {
    let entry = PecalWidgetEntry(date: .now, payload: loadPayload())
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: .now) ?? .now.addingTimeInterval(900)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func loadPayload() -> PecalWidgetPayload? {
    guard
      let defaults = UserDefaults(suiteName: suiteName),
      let raw = defaults.string(forKey: storageKey),
      let data = raw.data(using: .utf8)
    else { return nil }

    return try? JSONDecoder().decode(PecalWidgetPayload.self, from: data)
  }
}

struct PecalWidgetEntryView: View {
  var entry: PecalWidgetProvider.Entry

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(entry.payload?.workspace_name ?? "Pecal")
        .font(.headline)
      if let task = entry.payload?.tasks.first {
        Text(task.title).font(.subheadline).bold()
        Text("\(task.start_time) - \(task.end_time)").font(.caption)
      } else {
        Text("예정 일정 없음").font(.caption)
      }
    }
    .padding()
  }
}

@main
struct PecalWidget: Widget {
  let kind = "PecalWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: PecalWidgetProvider()) { entry in
      PecalWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Pecal 일정")
    .description("다가오는 일정을 보여줍니다.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
```

## 6) 현재 JS 연동 상태

이미 앱 코드에 아래가 반영되어 있습니다.

- 파일: `apps/mobile/src/lib/widget-bridge.ts`
- 파일: `apps/mobile/src/contexts/MobileAppContext.tsx`

동작:

1. 로그인 + 워크스페이스 선택 + tasks 변경 시 위젯 payload 동기화
2. 로그아웃 시 위젯 데이터 제거
3. iOS가 아니거나 네이티브 브리지가 없으면 무시(앱 정상 동작)

## 7) 확인 방법

1. 앱 실행 후 일정 로드
2. 홈 화면에서 위젯 추가
3. 일정 변경 후 위젯 반영 확인

## 8) 주의

- `suiteName`(`group.site.pecal.app`)은 앱/위젯/JS 문서 모두 동일해야 합니다.
- Extension target Membership 누락 시 빌드는 돼도 위젯이 빈 상태로 보입니다.
- Debug/Release 모두 Signing Team, Bundle Identifier 확인하세요.
