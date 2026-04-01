package com.pecal.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

class PecalMonthWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    updateAll(context, appWidgetManager, appWidgetIds)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      AppWidgetManager.ACTION_APPWIDGET_UPDATE,
      ACTION_REFRESH -> refreshAll(context)
      ACTION_OPEN_DATE -> {
        val date = intent.getStringExtra("date")
        openCalendar(context, date)
      }
      ACTION_TOGGLE_TASK -> {
        val taskId = intent.getIntExtra("taskId", 0)
        val currentStatus = intent.getStringExtra("currentStatus") ?: "TODO"
        if (taskId > 0) {
          val newStatus = if (currentStatus == "DONE") "TODO" else "DONE"
          if (applyLocalStatus(context, taskId, newStatus)) {
            refreshAll(context)
          }
          syncStatusToServerAsync(context, taskId, newStatus)
        }
      }
    }
  }

  companion object {
    const val ACTION_REFRESH = "com.pecal.mobile.widget.ACTION_REFRESH"
    const val ACTION_OPEN_DATE = "com.pecal.mobile.widget.ACTION_OPEN_DATE"
    const val ACTION_TOGGLE_TASK = "com.pecal.mobile.widget.ACTION_TOGGLE_TASK"

    fun updateAll(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
      val prefs = context.getSharedPreferences(PecalWidgetStorage.PREFS_NAME, Context.MODE_PRIVATE)
      val payload = PecalWidgetParser.parsePayload(prefs.getString(PecalWidgetStorage.PAYLOAD_KEY, null))
      val month = LocalDate.now().withDayOfMonth(1)
      val monthHeader = PecalWidgetParser.formatHeaderMonth(month)
      val nickname = payload?.nickname?.takeIf { it.isNotBlank() } ?: "Pecal"

      widgetIds.forEach { widgetId ->
        val views = RemoteViews(context.packageName, R.layout.widget_pecal)
        views.setTextViewText(R.id.widgetMonthTitle, monthHeader)
        views.setTextViewText(R.id.widgetNickname, "${nickname}의 일정")

        val serviceIntent = Intent(context, PecalMonthWidgetService::class.java).apply {
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
          data = android.net.Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
        }
        views.setRemoteAdapter(R.id.widgetMonthGrid, serviceIntent)
        views.setEmptyView(R.id.widgetMonthGrid, R.id.widgetEmpty)

        val templateIntent = Intent(context, PecalMonthWidgetProvider::class.java).apply {
          action = ACTION_OPEN_DATE
        }
        val templatePendingIntent = PendingIntent.getBroadcast(
          context,
          widgetId,
          templateIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.widgetMonthGrid, templatePendingIntent)

        val refreshIntent = Intent(context, PecalMonthWidgetProvider::class.java).apply {
          action = ACTION_REFRESH
        }
        val refreshPendingIntent = PendingIntent.getBroadcast(
          context,
          widgetId + 10000,
          refreshIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widgetHeaderContainer, refreshPendingIntent)

        manager.updateAppWidget(widgetId, views)
      }

      manager.notifyAppWidgetViewDataChanged(widgetIds, R.id.widgetMonthGrid)
    }

    private fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, PecalMonthWidgetProvider::class.java))
      if (ids.isNotEmpty()) {
        updateAll(context, manager, ids)
      }
    }

    private fun openCalendar(context: Context, date: String?) {
      val path = if (date.isNullOrBlank()) "myapp://calendar" else "myapp://calendar?date=$date"
      val openAppIntent = Intent(context, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        data = android.net.Uri.parse(path)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      context.startActivity(openAppIntent)
    }

    private fun applyLocalStatus(context: Context, taskId: Int, newStatus: String): Boolean {
      val prefs = context.getSharedPreferences(PecalWidgetStorage.PREFS_NAME, Context.MODE_PRIVATE)
      val raw = prefs.getString(PecalWidgetStorage.PAYLOAD_KEY, null) ?: return false
      val updated = runCatching {
        val root = JSONObject(raw)
        val rootTasks = root.optJSONArray("tasks")
        if (rootTasks != null) {
          for (i in 0 until rootTasks.length()) {
            val task = rootTasks.optJSONObject(i) ?: continue
            if (task.optInt("id", 0) == taskId) {
              task.put("status", newStatus)
            }
          }
        }
        val workspaces = root.optJSONArray("workspaces") ?: JSONArray()
        for (i in 0 until workspaces.length()) {
          val workspace = workspaces.optJSONObject(i) ?: continue
          val tasks = workspace.optJSONArray("tasks") ?: continue
          for (j in 0 until tasks.length()) {
            val task = tasks.optJSONObject(j) ?: continue
            if (task.optInt("id", 0) == taskId) {
              task.put("status", newStatus)
            }
          }
        }
        root.toString()
      }.getOrNull() ?: return false

      prefs.edit().putString(PecalWidgetStorage.PAYLOAD_KEY, updated).apply()
      return true
    }

    private fun syncStatusToServerAsync(context: Context, taskId: Int, newStatus: String) {
      Thread {
        runCatching {
          val prefs = context.getSharedPreferences(PecalWidgetStorage.PREFS_NAME, Context.MODE_PRIVATE)
          val raw = prefs.getString(PecalWidgetStorage.PAYLOAD_KEY, null) ?: return@runCatching
          val root = JSONObject(raw)
          val token = root.optString("access_token", "")
          val baseUrl = root.optString("api_base_url", "")
          if (token.isBlank() || baseUrl.isBlank()) return@runCatching

          val normalizedBase = if (baseUrl.endsWith("/")) baseUrl.dropLast(1) else baseUrl
          val url = URL("$normalizedBase/api/tasks")
          val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "PATCH"
            connectTimeout = 5000
            readTimeout = 8000
            doOutput = true
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("X-Client-Platform", "android-widget")
            setRequestProperty("X-App-Version", "widget")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
              setRequestProperty("X-Client-Name", "Android Widget")
            }
          }
          OutputStreamWriter(conn.outputStream).use { writer ->
            writer.write(JSONObject().put("task_id", taskId).put("status", newStatus).toString())
            writer.flush()
          }
          conn.responseCode
          conn.disconnect()
        }
      }.start()
    }
  }
}
