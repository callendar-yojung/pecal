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
