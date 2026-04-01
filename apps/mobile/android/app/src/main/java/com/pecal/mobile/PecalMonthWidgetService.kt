package com.pecal.mobile

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

class PecalMonthWidgetService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
    return PecalMonthWidgetFactory(applicationContext, intent)
  }
}

class PecalMonthWidgetFactory(
  private val context: Context,
  intent: Intent
) : RemoteViewsService.RemoteViewsFactory {
  private val appWidgetId: Int =
    intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
  private var items: List<PecalWidgetDayCell> = emptyList()
  private val dateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US)

  override fun onCreate() = Unit

  override fun onDataSetChanged() {
    val prefs = context.getSharedPreferences(PecalWidgetStorage.PREFS_NAME, Context.MODE_PRIVATE)
    val payload = PecalWidgetParser.parsePayload(prefs.getString(PecalWidgetStorage.PAYLOAD_KEY, null))
    items = PecalWidgetParser.buildMonthCells(payload, LocalDate.now().withDayOfMonth(1))
  }

  override fun onDestroy() {
    items = emptyList()
  }

  override fun getCount(): Int = items.size

  override fun getViewAt(position: Int): RemoteViews {
    if (position !in items.indices) {
      return RemoteViews(context.packageName, R.layout.widget_pecal_day_cell)
    }
    val cell = items[position]
    val views = RemoteViews(context.packageName, R.layout.widget_pecal_day_cell)
    val multiTask = cell.visibleMultiTask
    val maxSingleLines = if (cell.specialDay.isNullOrBlank()) {
      if (multiTask != null) 1 else 2
    } else {
      if (multiTask != null) 0 else 1
    }
    val displaySingleTasks = cell.visibleSingleTasks.take(maxSingleLines)
    val additionalHiddenFromCap = (cell.visibleSingleTasks.size - displaySingleTasks.size).coerceAtLeast(0)
    val effectiveHiddenCount = cell.hiddenCount + additionalHiddenFromCap

    views.setTextViewText(R.id.widgetDayNumber, cell.dayLabel)
    views.setTextColor(
      R.id.widgetDayNumber,
      when {
        cell.isToday -> Color.parseColor("#2563EB")
        !cell.isCurrentMonth -> Color.parseColor("#CBD5E1")
        else -> Color.parseColor("#1F2937")
      }
    )

    val special = cell.specialDay?.takeIf { it.isNotBlank() }
    if (special != null) {
      views.setViewVisibility(R.id.widgetSpecialDay, View.VISIBLE)
      views.setTextViewText(R.id.widgetSpecialDay, special)
      views.setTextColor(R.id.widgetSpecialDay, Color.parseColor("#EF4444"))
    } else {
      views.setViewVisibility(R.id.widgetSpecialDay, View.INVISIBLE)
      views.setTextViewText(R.id.widgetSpecialDay, "")
    }

    if (multiTask != null) {
      views.setViewVisibility(R.id.widgetMultiTask, View.VISIBLE)
      views.setInt(
        R.id.widgetMultiTask,
        "setBackgroundResource",
        when {
          cell.isMultiStart && cell.isMultiEnd -> R.drawable.widget_pecal_multi_single_bg
          cell.isMultiStart -> R.drawable.widget_pecal_multi_start_bg
          cell.isMultiEnd -> R.drawable.widget_pecal_multi_end_bg
          else -> R.drawable.widget_pecal_multi_mid_bg
        }
      )
      val showMultiTitle = cell.isMultiStart || cell.date.dayOfWeek.value % 7 == 0
      views.setTextViewText(R.id.widgetMultiTask, if (showMultiTitle) multiTask.title else "")
      views.setTextColor(R.id.widgetMultiTask, Color.parseColor("#FFFFFF"))
    } else {
      views.setViewVisibility(R.id.widgetMultiTask, View.GONE)
    }

    setTaskLine(
      views = views,
      rowId = R.id.widgetTaskRow1,
      checkId = R.id.widgetTaskCheck1,
      titleId = R.id.widgetTaskTitle1,
      task = displaySingleTasks.getOrNull(0),
      appWidgetId = appWidgetId
    )
    setTaskLine(
      views = views,
      rowId = R.id.widgetTaskRow2,
      checkId = R.id.widgetTaskCheck2,
      titleId = R.id.widgetTaskTitle2,
      task = displaySingleTasks.getOrNull(1),
      appWidgetId = appWidgetId
    )

    if (effectiveHiddenCount > 0) {
      views.setViewVisibility(R.id.widgetMoreCount, View.VISIBLE)
      views.setTextViewText(R.id.widgetMoreCount, "+${effectiveHiddenCount} more")
      views.setTextColor(R.id.widgetMoreCount, Color.parseColor("#64748B"))
    } else {
      views.setViewVisibility(R.id.widgetMoreCount, View.GONE)
    }

    val clickIntent = Intent().apply {
      action = PecalMonthWidgetProvider.ACTION_OPEN_DATE
      data = android.net.Uri.parse("myapp://calendar?date=${cell.date.format(dateFormatter)}")
      putExtra("date", cell.date.format(dateFormatter))
      putExtra("appWidgetId", appWidgetId)
    }
    views.setOnClickFillInIntent(R.id.widgetDayCellRoot, clickIntent)
    return views
  }

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewTypeCount(): Int = 1

  override fun getItemId(position: Int): Long {
    return items.getOrNull(position)?.date?.toEpochDay() ?: position.toLong()
  }

  override fun hasStableIds(): Boolean = true

  private fun setTaskLine(
    views: RemoteViews,
    rowId: Int,
    checkId: Int,
    titleId: Int,
    task: PecalWidgetTask?,
    appWidgetId: Int
  ) {
    if (task == null || task.title.isBlank()) {
      views.setViewVisibility(rowId, View.GONE)
      return
    }
    val done = task.status == "DONE"
    views.setViewVisibility(rowId, View.VISIBLE)
    val baseColor = parseTaskColor(task.color)
    val titleColor = if (done) Color.parseColor("#94A3B8") else textColorForBackground(baseColor)
    views.setTextViewText(checkId, if (done) "●" else "○")
    views.setTextColor(checkId, Color.parseColor(if (done) "#2563EB" else "#94A3B8"))
    views.setTextViewText(titleId, task.title)
    views.setTextColor(titleId, titleColor)
    views.setInt(
      rowId,
      "setBackgroundResource",
      if (done) R.drawable.widget_pecal_single_done_bg else singleDrawableForColor(task.color)
    )

    val toggleIntent = Intent().apply {
      action = PecalMonthWidgetProvider.ACTION_TOGGLE_TASK
      data = android.net.Uri.parse("myapp://calendar/toggle?taskId=${task.id}&status=${task.status}&wid=${appWidgetId}")
      putExtra("taskId", task.id)
      putExtra("currentStatus", task.status)
      putExtra("appWidgetId", appWidgetId)
    }
    views.setOnClickFillInIntent(checkId, toggleIntent)
  }

  private fun parseTaskColor(raw: String?): Int {
    if (raw.isNullOrBlank()) return Color.parseColor("#3B82F6")
    return runCatching { Color.parseColor(raw) }.getOrDefault(Color.parseColor("#3B82F6"))
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

  private fun textColorForBackground(bg: Int): Int {
    val luminance = (0.299f * Color.red(bg) + 0.587f * Color.green(bg) + 0.114f * Color.blue(bg)) / 255f
    return if (luminance < 0.52f) Color.WHITE else Color.parseColor("#0F172A")
  }
}
