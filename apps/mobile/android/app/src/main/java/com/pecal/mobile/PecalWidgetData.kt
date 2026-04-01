package com.pecal.mobile

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

data class PecalWidgetTask(
  val id: Int,
  val title: String,
  val startTime: String,
  val endTime: String,
  val status: String,
  val color: String,
)

data class PecalWidgetWorkspace(
  val workspaceId: Int,
  val workspaceName: String,
  val tasks: List<PecalWidgetTask>,
)

data class PecalWidgetPayload(
  val nickname: String,
  val workspaces: List<PecalWidgetWorkspace>,
  val specialDaysByDate: Map<String, List<String>>,
)

data class PecalWidgetDayCell(
  val date: LocalDate,
  val dayLabel: String,
  val isCurrentMonth: Boolean,
  val isToday: Boolean,
  val specialDay: String?,
  val visibleMultiTask: PecalWidgetTask?,
  val isMultiStart: Boolean,
  val isMultiEnd: Boolean,
  val visibleSingleTasks: List<PecalWidgetTask>,
  val hiddenCount: Int,
)

object PecalWidgetStorage {
  const val PREFS_NAME = "pecal_widget_storage"
  const val PAYLOAD_KEY = "pecal_widget_payload"
}

object PecalWidgetParser {
  private val dateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US)

  fun parsePayload(rawJson: String?): PecalWidgetPayload? {
    if (rawJson.isNullOrBlank()) return null
    return runCatching {
      val root = JSONObject(rawJson)
      val nickname = root.optString("nickname", "Pecal")
      val workspaces = parseWorkspaces(root.optJSONArray("workspaces"))
      val specialDaysByDate = parseSpecialDays(root.optJSONObject("special_days_by_date"))
      PecalWidgetPayload(
        nickname = nickname,
        workspaces = workspaces,
        specialDaysByDate = specialDaysByDate,
      )
    }.getOrNull()
  }

  fun buildMonthCells(
    payload: PecalWidgetPayload?,
    month: LocalDate = LocalDate.now().withDayOfMonth(1),
  ): List<PecalWidgetDayCell> {
    val firstDay = month.withDayOfMonth(1)
    val monthStartWeekOffset = firstDay.dayOfWeek.value % 7 // sunday=0
    val gridStart = firstDay.minusDays(monthStartWeekOffset.toLong())
    val activeWorkspace = payload?.workspaces?.firstOrNull()
    val tasksByDate = buildTasksByDate(activeWorkspace?.tasks.orEmpty())
    val today = LocalDate.now()

    return (0 until 42).map { index ->
      val date = gridStart.plusDays(index.toLong())
      val dateKey = date.format(dateFormatter)
      val dayTasks = tasksByDate[dateKey].orEmpty()
      val multiTasks = dayTasks.filter { isMultiDayTask(it) }
      val singleTasks = dayTasks.filterNot { isMultiDayTask(it) }
      val visibleMultiTask = multiTasks.firstOrNull()
      val visibleMultiStart = visibleMultiTask?.let {
        val start = parseDateOnly(it.startTime)
        start == null || !date.isAfter(start)
      } ?: false
      val visibleMultiEnd = visibleMultiTask?.let {
        val end = parseDateOnly(it.endTime) ?: parseDateOnly(it.startTime)
        end == null || !date.isBefore(end)
      } ?: false
      // Keep the same max-visible policy (2/day), but reserve one slot for multi-day when present.
      val singleLimit = if (visibleMultiTask != null) 1 else 2
      val visibleSingleTasks = singleTasks.take(singleLimit)
      val visibleTotal = (if (visibleMultiTask != null) 1 else 0) + visibleSingleTasks.size
      PecalWidgetDayCell(
        date = date,
        dayLabel = date.dayOfMonth.toString(),
        isCurrentMonth = date.monthValue == month.monthValue && date.year == month.year,
        isToday = date == today,
        specialDay = payload?.specialDaysByDate?.get(dateKey)?.firstOrNull(),
        visibleMultiTask = visibleMultiTask,
        isMultiStart = visibleMultiStart,
        isMultiEnd = visibleMultiEnd,
        visibleSingleTasks = visibleSingleTasks,
        hiddenCount = (dayTasks.size - visibleTotal).coerceAtLeast(0),
      )
    }
  }

  fun formatHeaderMonth(month: LocalDate = LocalDate.now()): String {
    val monthLabel = month.month.name.lowercase(Locale.US).replaceFirstChar { it.titlecase(Locale.US) }
    return "${monthLabel.uppercase(Locale.US)} ${month.year}"
  }

  private fun parseWorkspaces(jsonArray: JSONArray?): List<PecalWidgetWorkspace> {
    if (jsonArray == null) return emptyList()
    val result = mutableListOf<PecalWidgetWorkspace>()
    for (i in 0 until jsonArray.length()) {
      val obj = jsonArray.optJSONObject(i) ?: continue
      val workspaceId = obj.optInt("workspace_id", 0)
      val workspaceName = obj.optString("workspace_name", "Workspace")
      val tasks = parseTasks(obj.optJSONArray("tasks"))
      result.add(
        PecalWidgetWorkspace(
          workspaceId = workspaceId,
          workspaceName = workspaceName,
          tasks = tasks,
        )
      )
    }
    return result
  }

  private fun parseTasks(jsonArray: JSONArray?): List<PecalWidgetTask> {
    if (jsonArray == null) return emptyList()
    val result = mutableListOf<PecalWidgetTask>()
    for (i in 0 until jsonArray.length()) {
      val obj = jsonArray.optJSONObject(i) ?: continue
      result.add(
        PecalWidgetTask(
          id = obj.optInt("id", 0),
          title = obj.optString("title", "제목 없음"),
          startTime = obj.optString("start_time", ""),
          endTime = obj.optString("end_time", obj.optString("start_time", "")),
          status = obj.optString("status", "TODO"),
          color = obj.optString("color", "#5B6CFF"),
        )
      )
    }
    return result
  }

  private fun parseSpecialDays(obj: JSONObject?): Map<String, List<String>> {
    if (obj == null) return emptyMap()
    val map = mutableMapOf<String, List<String>>()
    val keys = obj.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      val labelsArray = obj.optJSONArray(key) ?: continue
      val labels = mutableListOf<String>()
      for (i in 0 until labelsArray.length()) {
        labelsArray.optString(i)?.let { if (it.isNotBlank()) labels.add(it) }
      }
      if (labels.isNotEmpty()) {
        map[key] = labels
      }
    }
    return map
  }

  private fun buildTasksByDate(tasks: List<PecalWidgetTask>): Map<String, List<PecalWidgetTask>> {
    if (tasks.isEmpty()) return emptyMap()
    val grouped = mutableMapOf<String, MutableList<PecalWidgetTask>>()
    tasks.forEach { task ->
      val start = parseDateOnly(task.startTime) ?: return@forEach
      val end = parseDateOnly(task.endTime) ?: start
      var cursor = if (end.isBefore(start)) start else start
      val last = if (end.isBefore(start)) start else end
      while (!cursor.isAfter(last)) {
        val key = cursor.format(dateFormatter)
        grouped.getOrPut(key) { mutableListOf() }.add(task)
        cursor = cursor.plusDays(1)
      }
    }
    return grouped.mapValues { (_, value) ->
      value.sortedBy { parseDateTimeForSort(it.startTime) ?: Long.MAX_VALUE }
    }
  }

  private fun parseDateOnly(raw: String): LocalDate? {
    if (raw.length >= 10) {
      return runCatching { LocalDate.parse(raw.substring(0, 10), dateFormatter) }.getOrNull()
    }
    return null
  }

  private fun isMultiDayTask(task: PecalWidgetTask): Boolean {
    val start = parseDateOnly(task.startTime) ?: return false
    val end = parseDateOnly(task.endTime) ?: start
    return end.isAfter(start)
  }

  private fun parseDateTimeForSort(raw: String): Long? {
    if (raw.length < 16) return null
    val normalized = raw.replace(' ', 'T')
    return runCatching { java.time.LocalDateTime.parse(normalized).atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli() }.getOrNull()
  }
}
