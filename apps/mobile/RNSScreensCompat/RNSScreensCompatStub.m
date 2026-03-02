#import <UIKit/UIKit.h>
#import <RNScreens/RNSScreen.h>

#if __has_include(<RNScreens/RNSBottomTabsScreenComponentView.h>)
#import <RNScreens/RNSBottomTabsScreenComponentView.h>
#else
@interface RNSBottomTabsScreenComponentView : UIView
@property(nonatomic, copy) NSString *tabKey;
- (UIViewController *)reactViewController;
@end
#endif

#if __has_include(<RNScreens/RNSBottomTabsHostComponentView.h>)
#import <RNScreens/RNSBottomTabsHostComponentView.h>
#else
@interface RNSBottomTabsHostComponentView : UIView
- (UITabBarController *)controller;
@end
#endif

#if __has_include(<RNScreens/RNSTabBarController.h>)
#import <RNScreens/RNSTabBarController.h>
#else
@interface RNSTabBarController : UITabBarController @end
#endif

#if __has_include(<RNScreens/RNSScreenStack.h>)
#import <RNScreens/RNSScreenStack.h>
#else
@interface RNSScreenStackView : UIView @end
#endif

@interface RNSScreenStackView (PecalCompat)
@property(nonatomic, copy) NSArray<NSString *> *screenIds;
@property(nonatomic, copy) NSArray<UIView *> *reactSubviews;
@end
@implementation RNSScreenStackView (PecalCompat)
- (NSArray<NSString *> *)screenIds { return @[]; }
- (void)setScreenIds:(NSArray<NSString *> *)value {}
- (NSArray<UIView *> *)reactSubviews { return @[]; }
- (void)setReactSubviews:(NSArray<UIView *> *)value {}
@end

@interface RNSScreenView (PecalCompat)
@property(nonatomic, copy) NSString *screenId;
@end
@implementation RNSScreenView (PecalCompat)
- (NSString *)screenId { return nil; }
- (void)setScreenId:(NSString *)value {}
@end
