package com.pecal.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

class PecalTodayWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    updateAll(context, appWidgetManager, appWidgetIds)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      AppWidgetManager.ACTION_APPWIDGET_UPDATE,
      ACTION_REFRESH -> refreshAll(context)
      PecalMonthWidgetProvider.ACTION_TOGGLE_TASK -> {
        val taskId = intent.getIntExtra("taskId", 0)
        val currentStatus = intent.getStringExtra("currentStatus") ?: "TODO"
        if (taskId > 0) {
          val newStatus = if (currentStatus == "DONE") "TODO" else "DONE"
          if (applyLocalStatus(context, taskId, newStatus)) {
            refreshBothWidgets(context)
          }
          syncStatusToServerAsync(context, taskId, newStatus)
        }
      }
      PecalMonthWidgetProvider.ACTION_OPEN_DATE -> {
        openCalendar(context, intent.getStringExtra("date"))
      }
    }
  }

  companion object {
    const val ACTION_REFRESH = "com.pecal.mobile.widget.ACTION_TODAY_REFRESH"
    private const val MAX_VISIBLE = 3

    fun updateAll(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
      val prefs = context.getSharedPreferences(PecalWidgetStorage.PREFS_NAME, Context.MODE_PRIVATE)
      val payload = PecalWidgetParser.parsePayload(prefs.getString(PecalWidgetStorage.PAYLOAD_KEY, null))
      val workspace = payload?.workspaces?.firstOrNull()
      val todayTasks = tasksForToday(workspace)
      val nickname = payload?.nickname?.takeIf { it.isNotBlank() } ?: "Pecal"
      val monthText = "${LocalDate.now().monthValue}월"
      val headerMeta = "${workspace?.workspaceName ?: "${nickname}의 일정"} · $monthText"

      widgetIds.forEach { widgetId ->
        val views = RemoteViews(context.packageName, R.layout.widget_pecal_today)
        views.setTextViewText(R.id.widgetTodayHeaderTitle, "TODAY")
        views.setTextViewText(R.id.widgetTodayHeaderMeta, headerMeta)

        if (todayTasks.isEmpty()) {
          views.setViewVisibility(R.id.widgetTodayEmpty, android.view.View.VISIBLE)
        } else {
          views.setViewVisibility(R.id.widgetTodayEmpty, android.view.View.GONE)
        }

        bindTaskRow(
          context = context,
          views = views,
          rowId = R.id.widgetTodayRow1,
          checkId = R.id.widgetTodayCheck1,
          timeId = R.id.widgetTodayTime1,
          titleId = R.id.widgetTodayTitle1,
          task = todayTasks.getOrNull(0),
          appWidgetId = widgetId,
        )
        bindTaskRow(context, views, R.id.widgetTodayRow2, R.id.widgetTodayCheck2, R.id.widgetTodayTime2, R.id.widgetTodayTitle2, todayTasks.getOrNull(1), widgetId)
        bindTaskRow(context, views, R.id.widgetTodayRow3, R.id.widgetTodayCheck3, R.id.widgetTodayTime3, R.id.widgetTodayTitle3, todayTasks.getOrNull(2), widgetId)

        val openAppIntent = Intent(context, MainActivity::class.java).apply {
          action = Intent.ACTION_VIEW
          data = android.net.Uri.parse("myapp://overview")
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPending = PendingIntent.getActivity(
          context,
          widgetId + 30000,
          openAppIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.widgetTodayRoot, openPending)

        val refreshIntent = Intent(context, PecalTodayWidgetProvider::class.java).apply {
          action = ACTION_REFRESH
        }
        val refreshPending = PendingIntent.getBroadcast(
          context,
          widgetId + 31000,
          refreshIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.widgetTodayHeaderContainer, refreshPending)

        manager.updateAppWidget(widgetId, views)
      }
    }

    private fun bindTaskRow(
      context: Context,
      views: RemoteViews,
      rowId: Int,
      checkId: Int,
      timeId: Int,
      titleId: Int,
      task: PecalWidgetTask?,
      appWidgetId: Int,
    ) {
      if (task == null) {
        views.setViewVisibility(rowId, android.view.View.GONE)
        return
      }
      val done = task.status.equals("DONE", ignoreCase = true)
      views.setViewVisibility(rowId, android.view.View.VISIBLE)
      views.setImageViewResource(
        checkId,
        if (done) R.drawable.widget_today_checkbox_checked else R.drawable.widget_today_checkbox_unchecked,
      )
      views.setTextViewText(timeId, timeLabel(task))
      views.setTextColor(timeId, Color.parseColor(if (done) "#94A3B8" else "#EAF2FF"))
      views.setTextViewText(titleId, task.title)
      views.setTextColor(titleId, Color.parseColor(if (done) "#94A3B8" else "#1F2937"))
      views.setInt(
        rowId,
        "setBackgroundResource",
        if (done) R.drawable.widget_pecal_single_done_bg else singleDrawableForColor(task.color),
      )

      if (done) {
        views.setInt(titleId, "setPaintFlags", 16 /* Paint.STRIKE_THRU_TEXT_FLAG */)
      } else {
        views.setInt(titleId, "setPaintFlags", 0)
      }

      val toggleIntent = Intent(context, PecalTodayWidgetProvider::class.java).apply {
        action = PecalMonthWidgetProvider.ACTION_TOGGLE_TASK
        data = android.net.Uri.parse("myapp://today/toggle?taskId=${task.id}&status=${task.status}&wid=${appWidgetId}")
        putExtra("taskId", task.id)
        putExtra("currentStatus", task.status)
        putExtra("appWidgetId", appWidgetId)
      }
      val pending = PendingIntent.getBroadcast(
        context,
        (task.id * 10) + appWidgetId,
        toggleIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      views.setOnClickPendingIntent(checkId, pending)
    }

    private fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, PecalTodayWidgetProvider::class.java))
      if (ids.isNotEmpty()) {
        updateAll(context, manager, ids)
      }
    }

    private fun refreshBothWidgets(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val todayIds = manager.getAppWidgetIds(ComponentName(context, PecalTodayWidgetProvider::class.java))
      if (todayIds.isNotEmpty()) {
        updateAll(context, manager, todayIds)
      }
      val monthIds = manager.getAppWidgetIds(ComponentName(context, PecalMonthWidgetProvider::class.java))
      if (monthIds.isNotEmpty()) {
        manager.notifyAppWidgetViewDataChanged(monthIds, R.id.widgetMonthGrid)
        PecalMonthWidgetProvider.updateAll(context, manager, monthIds)
      }
    }

    private fun tasksForToday(workspace: PecalWidgetWorkspace?): List<PecalWidgetTask> {
      if (workspace == null) return emptyList()
      val today = LocalDate.now()
      return workspace.tasks
        .filter { task ->
          val start = parseDateOnly(task.startTime) ?: return@filter false
          val end = parseDateOnly(task.endTime) ?: start
          val rangeEnd = if (end.isBefore(start)) start else end
          !today.isBefore(start) && !today.isAfter(rangeEnd)
        }
        .sortedBy { parseDateTimeForSort(it.startTime) ?: Long.MAX_VALUE }
        .take(MAX_VISIBLE)
    }

    private fun parseDateOnly(raw: String): LocalDate? {
      if (raw.length < 10) return null
      return runCatching {
        LocalDate.parse(raw.substring(0, 10), DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US))
      }.getOrNull()
    }

    private fun parseDateTimeForSort(raw: String): Long? {
      if (raw.length < 16) return null
      val normalized = raw.replace(' ', 'T')
      return runCatching {
        LocalDateTime.parse(normalized).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
      }.getOrNull()
    }

    private fun timeLabel(task: PecalWidgetTask): String {
      val start = task.startTime.takeIf { it.length >= 16 }?.substring(11, 16) ?: "--:--"
      val end = task.endTime.takeIf { it.length >= 16 }?.substring(11, 16) ?: start
      return "$start-$end"
    }

    private fun singleDrawableForColor(raw: String?): Int {
      return when (raw?.uppercase(Locale.US)) {
        "#3B82F6" -> R.drawable.widget_pecal_single_blue_bg
        "#EF4444" -> R.drawable.widget_pecal_single_red_bg
        "#10B981" -> R.drawable.widget_pecal_single_green_bg
        "#F59E0B" -> R.drawable.widget_pecal_single_amber_bg
        "#8B5CF6" -> R.drawable.widget_pecal_single_purple_bg
        "#EC4899" -> R.drawable.widget_pecal_single_pink_bg
        "#6366F1" -> R.drawable.widget_pecal_single_indigo_bg
        "#14B8A6" -> R.drawable.widget_pecal_single_teal_bg
        else -> R.drawable.widget_pecal_single_blue_bg
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
            if (task.optInt("id", 0) == taskId) task.put("status", newStatus)
          }
        }
        val workspaces = root.optJSONArray("workspaces") ?: JSONArray()
        for (i in 0 until workspaces.length()) {
          val workspace = workspaces.optJSONObject(i) ?: continue
          val tasks = workspace.optJSONArray("tasks") ?: continue
          for (j in 0 until tasks.length()) {
            val task = tasks.optJSONObject(j) ?: continue
            if (task.optInt("id", 0) == taskId) task.put("status", newStatus)
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
