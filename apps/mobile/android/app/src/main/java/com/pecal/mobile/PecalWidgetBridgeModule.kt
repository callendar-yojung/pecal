package com.pecal.mobile

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PecalWidgetBridgeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "PecalWidgetBridge"

  @ReactMethod
  fun setWidgetData(jsonPayload: String, promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(PecalWidgetStorage.PREFS_NAME, android.content.Context.MODE_PRIVATE)
      prefs.edit().putString(PecalWidgetStorage.PAYLOAD_KEY, jsonPayload).apply()
      refreshWidgets()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("WIDGET_SET_FAILED", e)
    }
  }

  @ReactMethod
  fun clearWidgetData(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(PecalWidgetStorage.PREFS_NAME, android.content.Context.MODE_PRIVATE)
      prefs.edit().remove(PecalWidgetStorage.PAYLOAD_KEY).apply()
      refreshWidgets()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("WIDGET_CLEAR_FAILED", e)
    }
  }

  @ReactMethod
  fun reloadAllTimelines(promise: Promise) {
    try {
      refreshWidgets()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("WIDGET_RELOAD_FAILED", e)
    }
  }

  private fun refreshWidgets() {
    val manager = AppWidgetManager.getInstance(reactContext)
    val monthIds = manager.getAppWidgetIds(ComponentName(reactContext, PecalMonthWidgetProvider::class.java))
    if (monthIds.isNotEmpty()) {
      manager.notifyAppWidgetViewDataChanged(monthIds, R.id.widgetMonthGrid)
      PecalMonthWidgetProvider.updateAll(reactContext, manager, monthIds)
    }
    val todayIds = manager.getAppWidgetIds(ComponentName(reactContext, PecalTodayWidgetProvider::class.java))
    if (todayIds.isNotEmpty()) {
      PecalTodayWidgetProvider.updateAll(reactContext, manager, todayIds)
    }
  }
}
