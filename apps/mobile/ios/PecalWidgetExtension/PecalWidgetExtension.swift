import WidgetKit
import SwiftUI
import AppIntents

let pecalWidgetSuiteName = "group.site.pecal.app"
let pecalWidgetStorageKey = "pecal_widget_payload"

struct PecalWidgetTask: Codable {
  let id: Int
  let title: String
  let start_time: String
  let end_time: String
  let status: String
  let color: String
}

struct PecalWidgetWorkspace: Codable {
  let workspace_id: Int
  let workspace_name: String
  let tasks: [PecalWidgetTask]
}

struct PecalWidgetPayload: Codable {
  let generated_at: String
  let nickname: String
  let theme: String?
  let api_base_url: String?
  let access_token: String?
  let refresh_token: String?
  let member_id: Int?
  let workspace_name: String?
  let tasks: [PecalWidgetTask]?
  let workspaces: [PecalWidgetWorkspace]
  let special_days_by_date: [String: [String]]?
  let widget_feedback_task_id: Int?
  let widget_feedback_until: String?
  let widget_skip_network_until: String?

  private enum CodingKeys: String, CodingKey {
    case generated_at
    case nickname
    case theme
    case api_base_url
    case access_token
    case refresh_token
    case member_id
    case workspaces
    case workspace_name
    case tasks
    case special_days_by_date
    case widget_feedback_task_id
    case widget_feedback_until
    case widget_skip_network_until
  }

  init(
    generated_at: String,
    nickname: String,
    theme: String?,
    api_base_url: String?,
    access_token: String?,
    refresh_token: String?,
    member_id: Int?,
    workspace_name: String?,
    tasks: [PecalWidgetTask]?,
    workspaces: [PecalWidgetWorkspace],
    special_days_by_date: [String: [String]]?,
    widget_feedback_task_id: Int? = nil,
    widget_feedback_until: String? = nil,
    widget_skip_network_until: String? = nil
  ) {
    self.generated_at = generated_at
    self.nickname = nickname
    self.theme = theme
    self.api_base_url = api_base_url
    self.access_token = access_token
    self.refresh_token = refresh_token
    self.member_id = member_id
    self.workspace_name = workspace_name
    self.tasks = tasks
    self.workspaces = workspaces
    self.special_days_by_date = special_days_by_date
    self.widget_feedback_task_id = widget_feedback_task_id
    self.widget_feedback_until = widget_feedback_until
    self.widget_skip_network_until = widget_skip_network_until
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    generated_at = try container.decodeIfPresent(String.self, forKey: .generated_at) ?? ""
    nickname = try container.decodeIfPresent(String.self, forKey: .nickname) ?? "Pecal"
    theme = try container.decodeIfPresent(String.self, forKey: .theme)
    api_base_url = try container.decodeIfPresent(String.self, forKey: .api_base_url)
    access_token = try container.decodeIfPresent(String.self, forKey: .access_token)
    refresh_token = try container.decodeIfPresent(String.self, forKey: .refresh_token)
    member_id = try container.decodeIfPresent(Int.self, forKey: .member_id)
    special_days_by_date = try container.decodeIfPresent([String: [String]].self, forKey: .special_days_by_date)
    widget_feedback_task_id = try container.decodeIfPresent(Int.self, forKey: .widget_feedback_task_id)
    widget_feedback_until = try container.decodeIfPresent(String.self, forKey: .widget_feedback_until)
    widget_skip_network_until = try container.decodeIfPresent(String.self, forKey: .widget_skip_network_until)
    let legacyWorkspaceName = try container.decodeIfPresent(String.self, forKey: .workspace_name)
    let legacyTasks = try container.decodeIfPresent([PecalWidgetTask].self, forKey: .tasks)
    workspace_name = legacyWorkspaceName
    tasks = legacyTasks

    if let workspaces = try container.decodeIfPresent([PecalWidgetWorkspace].self, forKey: .workspaces),
       !workspaces.isEmpty {
      self.workspaces = workspaces
      return
    }

    self.workspaces = [
      PecalWidgetWorkspace(
        workspace_id: 0,
        workspace_name: legacyWorkspaceName ?? "Workspace",
        tasks: legacyTasks ?? []
      ),
    ]
  }
}

private struct PecalTasksResponse: Decodable {
  let tasks: [PecalWidgetTask]?
}

struct PecalWidgetEntry: TimelineEntry {
  let date: Date
  let payload: PecalWidgetPayload?
  let selectedWorkspaceId: Int?
}

private struct MonthDayCell: Identifiable {
  let id: Int
  let date: Date?
  let inCurrentMonth: Bool
}

private struct MonthTaskSegment: Identifiable {
  let id: String
  let task: PecalWidgetTask
  let row: Int
  let startCol: Int
  let endCol: Int
  let lane: Int
  let isStart: Bool
  let isEnd: Bool
}

private struct MonthDayRenderData {
  let visibleSingleTasks: [PecalWidgetTask]
  let hiddenCount: Int
  let visibleMultiCount: Int
}

private struct MonthRenderLayout {
  let visibleSegmentsByRow: [Int: [MonthTaskSegment]]
  let dayDataByKey: [String: MonthDayRenderData]
}

struct PecalWidgetProvider: AppIntentTimelineProvider {
  typealias Intent = ConfigurationAppIntent

  func placeholder(in context: Context) -> PecalWidgetEntry {
    PecalWidgetEntry(date: .now, payload: nil, selectedWorkspaceId: nil)
  }

  func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> PecalWidgetEntry {
    PecalWidgetEntry(
      date: .now,
      payload: await resolvePecalWidgetPayload(),
      selectedWorkspaceId: configuration.workspace?.id
    )
  }

  func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<PecalWidgetEntry> {
    let payload = await resolvePecalWidgetPayload()
    let entry = PecalWidgetEntry(
      date: .now,
      payload: payload,
      selectedWorkspaceId: configuration.workspace?.id
    )
    let next = Calendar.current.date(byAdding: .minute, value: 10, to: .now) ?? .now.addingTimeInterval(600)
    return Timeline(entries: [entry], policy: .after(next))
  }
}

struct PecalWidgetEntryView: View {
  var entry: PecalWidgetProvider.Entry
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family
  private let maxVisibleTasksPerDay = 2
  private let widgetMultiLaneStep: CGFloat = 11
  private let widgetMultiBarTopOffset: CGFloat = 28
  private let widgetDayHeaderHeight: CGFloat = 26
  private let widgetSpecialDayFontSize: CGFloat = 6.5
  private let widgetSpecialDayLineHeight: CGFloat = 2

  private var calendar: Calendar {
    var cal = Calendar(identifier: .gregorian)
    cal.locale = Locale(identifier: "ko_KR")
    cal.timeZone = TimeZone.current
    return cal
  }

  private var displayedWorkspaces: [PecalWidgetWorkspace] {
    entry.payload?.workspaces ?? []
  }

  private var activeWorkspace: PecalWidgetWorkspace? {
    guard let payload = entry.payload else { return nil }
    if let selectedWorkspaceId = entry.selectedWorkspaceId,
       let matched = payload.workspaces.first(where: { $0.workspace_id == selectedWorkspaceId }) {
      return matched
    }
    if let legacyName = payload.workspaces.first(where: { $0.workspace_id == 0 })?.workspace_name {
      // Backward-compatible fallback for payloads that may include synthetic workspace_id = 0.
      return PecalWidgetWorkspace(
        workspace_id: 0,
        workspace_name: legacyName,
        tasks: payload.workspaces.first(where: { $0.workspace_id == 0 })?.tasks ?? []
      )
    }
    if let legacyWorkspaceName = payload.workspace_name {
      return PecalWidgetWorkspace(
        workspace_id: 0,
        workspace_name: legacyWorkspaceName,
        tasks: payload.tasks ?? []
      )
    }
    if payload.workspaces.count >= 1 {
      return payload.workspaces.first
    }
    return nil
  }

  private var workspaceName: String {
    activeWorkspace?.workspace_name ?? "Workspace"
  }

  private var isDarkTheme: Bool {
    if colorScheme == .dark {
      return true
    }
    let raw = entry.payload?.theme?.lowercased() ?? "light"
    return raw == "dark" || raw == "black"
  }

  private var widgetBgColor: Color {
    isDarkTheme ? Color(red: 0.08, green: 0.10, blue: 0.13) : Color.white
  }

  private var primaryTextColor: Color {
    isDarkTheme ? Color.white.opacity(0.92) : Color.black.opacity(0.72)
  }

  private var secondaryTextColor: Color {
    isDarkTheme ? Color(red: 0.74, green: 0.78, blue: 0.85) : Color.gray.opacity(0.9)
  }

  private var mutedTextColor: Color {
    isDarkTheme ? Color(red: 0.63, green: 0.68, blue: 0.76) : Color.gray
  }

  private var dayBorderColor: Color {
    isDarkTheme ? Color.white.opacity(0.12) : Color.gray.opacity(0.16)
  }

  private var otherMonthBgColor: Color {
    isDarkTheme ? Color.white.opacity(0.05) : Color.white.opacity(0.14)
  }

  private var monthTitle: String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "MMMM yyyy"
    return formatter.string(from: entry.date).uppercased()
  }

  private var todayKey: String {
    dayKey(Date())
  }

  private var weekdayLabels: [String] {
    ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
  }

  private var dayRows: [[MonthDayCell]] {
    stride(from: 0, to: dayCells.count, by: 7).map { start in
      let end = min(start + 7, dayCells.count)
      return Array(dayCells[start..<end])
    }
  }

  private var dayCells: [MonthDayCell] {
    let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: entry.date)) ?? entry.date
    let firstWeekday = calendar.component(.weekday, from: startOfMonth)
    let leading = (firstWeekday - calendar.firstWeekday + 7) % 7
    let daysInMonth = calendar.range(of: .day, in: .month, for: startOfMonth)?.count ?? 30
    let totalVisibleDays = leading + daysInMonth
    let requiredCellCount = Int(ceil(Double(totalVisibleDays) / 7.0) * 7.0)
    // Keep the calendar at least 5 rows for visual consistency.
    let cellCount = max(35, requiredCellCount)

    var cells: [MonthDayCell] = []
    cells.reserveCapacity(cellCount)

    for index in 0..<cellCount {
      let dayNumber = index - leading + 1
      if dayNumber >= 1 && dayNumber <= daysInMonth {
        let date = calendar.date(byAdding: .day, value: dayNumber - 1, to: startOfMonth)
        cells.append(MonthDayCell(id: index, date: date, inCurrentMonth: true))
      } else {
        cells.append(MonthDayCell(id: index, date: nil, inCurrentMonth: false))
      }
    }

    return cells
  }

  private func monthRenderLayout(for workspace: PecalWidgetWorkspace?) -> MonthRenderLayout {
    let tasks = dedupeTasksByID(workspace?.tasks ?? [])
    if tasks.isEmpty {
      return MonthRenderLayout(visibleSegmentsByRow: [:], dayDataByKey: [:])
    }

    let datedCells = dayCells.enumerated().compactMap { index, cell -> (index: Int, key: String)? in
      guard let date = cell.date else { return nil }
      return (index, dayKey(date))
    }
    if datedCells.isEmpty {
      return MonthRenderLayout(visibleSegmentsByRow: [:], dayDataByKey: [:])
    }

    let firstVisibleKey = datedCells.first?.key ?? ""
    let lastVisibleKey = datedCells.last?.key ?? ""
    var indexByDayKey: [String: Int] = [:]
    for item in datedCells {
      indexByDayKey[item.key] = item.index
    }

    var singleTasksByDay: [String: [PecalWidgetTask]] = [:]
    var allSegments: [MonthTaskSegment] = []
    var laneRangesByRow: [Int: [[ClosedRange<Int>]]] = [:]

    func laneFor(row: Int, startCol: Int, endCol: Int) -> Int {
      var lanes = laneRangesByRow[row] ?? []
      let targetRange = startCol...endCol
      for lane in lanes.indices {
        let hasConflict = lanes[lane].contains { existing in
          existing.overlaps(targetRange)
        }
        if !hasConflict {
          lanes[lane].append(targetRange)
          laneRangesByRow[row] = lanes
          return lane
        }
      }
      lanes.append([targetRange])
      laneRangesByRow[row] = lanes
      return lanes.count - 1
    }

    let sortedTasks = tasks.sorted { lhs, rhs in
      let l = parseISO(lhs.start_time) ?? .distantPast
      let r = parseISO(rhs.start_time) ?? .distantPast
      return l < r
    }

    for task in sortedTasks {
      guard let startDate = parseISO(task.start_time) else { continue }
      let endDate = parseISO(task.end_time) ?? startDate
      let startKey = dayKey(calendar.startOfDay(for: startDate))
      let endKey = dayKey(calendar.startOfDay(for: max(endDate, startDate)))

      if startKey == endKey {
        if startKey >= firstVisibleKey && startKey <= lastVisibleKey {
          singleTasksByDay[startKey, default: []].append(task)
        }
        continue
      }

      let clippedStartKey = max(startKey, firstVisibleKey)
      let clippedEndKey = min(endKey, lastVisibleKey)
      if clippedStartKey > clippedEndKey { continue }

      guard
        let clippedStartIndex = indexByDayKey[clippedStartKey],
        let clippedEndIndex = indexByDayKey[clippedEndKey]
      else { continue }

      let startRow = clippedStartIndex / 7
      let endRow = clippedEndIndex / 7

      for row in startRow...endRow {
        let rowStart = row * 7
        let rowEnd = rowStart + 6
        let segmentStartIndex = max(clippedStartIndex, rowStart)
        let segmentEndIndex = min(clippedEndIndex, rowEnd)
        let startCol = segmentStartIndex % 7
        let endCol = segmentEndIndex % 7
        let lane = laneFor(row: row, startCol: startCol, endCol: endCol)
        allSegments.append(
          MonthTaskSegment(
            id: "\(task.id)-\(row)-\(startCol)-\(endCol)-\(lane)",
            task: task,
            row: row,
            startCol: startCol,
            endCol: endCol,
            lane: lane,
            isStart: segmentStartIndex == clippedStartIndex,
            isEnd: segmentEndIndex == clippedEndIndex
          )
        )
      }
    }

    let visibleSegments = allSegments.filter { $0.lane < maxVisibleTasksPerDay }
    var visibleSegmentsByRow: [Int: [MonthTaskSegment]] = [:]
    for segment in visibleSegments {
      visibleSegmentsByRow[segment.row, default: []].append(segment)
    }

    var dayDataByKey: [String: MonthDayRenderData] = [:]
    for item in datedCells {
      let key = item.key
      let row = item.index / 7
      let col = item.index % 7
      let allMultiCount = allSegments.filter { $0.row == row && $0.startCol <= col && $0.endCol >= col }.count
      let visibleMultiCount = visibleSegments.filter { $0.row == row && $0.startCol <= col && $0.endCol >= col }.count
      let maxSingleVisible = max(0, maxVisibleTasksPerDay - visibleMultiCount)
      let singles = (singleTasksByDay[key] ?? []).sorted { lhs, rhs in
        let l = parseISO(lhs.start_time) ?? .distantPast
        let r = parseISO(rhs.start_time) ?? .distantPast
        return l < r
      }
      let visibleSingles = Array(singles.prefix(maxSingleVisible))
      let hiddenSingle = max(0, singles.count - maxSingleVisible)
      let hiddenMulti = max(0, allMultiCount - visibleMultiCount)
      dayDataByKey[key] = MonthDayRenderData(
        visibleSingleTasks: visibleSingles,
        hiddenCount: hiddenSingle + hiddenMulti,
        visibleMultiCount: visibleMultiCount
      )
    }

    return MonthRenderLayout(visibleSegmentsByRow: visibleSegmentsByRow, dayDataByKey: dayDataByKey)
  }

  private func tasksByDayKey(for workspace: PecalWidgetWorkspace?) -> [String: [PecalWidgetTask]] {
    let tasks = workspace?.tasks ?? []
    var grouped: [String: [PecalWidgetTask]] = [:]

    for task in tasks {
      guard let startDate = parseISO(task.start_time) else { continue }
      let rawEndDate = parseISO(task.end_time) ?? startDate

      let startDay = calendar.startOfDay(for: startDate)
      let endDay = calendar.startOfDay(for: rawEndDate)
      let rangeEnd = endDay >= startDay ? endDay : startDay

      var cursor = startDay
      while cursor <= rangeEnd {
        grouped[dayKey(cursor), default: []].append(task)
        guard let next = calendar.date(byAdding: .day, value: 1, to: cursor) else {
          break
        }
        cursor = next
      }
    }

    return grouped.mapValues { tasksInDay in
      tasksInDay.sorted { lhs, rhs in
        let l = parseISO(lhs.start_time) ?? .distantPast
        let r = parseISO(rhs.start_time) ?? .distantPast
        return l < r
      }
    }
  }

  private func todayTasks(for workspace: PecalWidgetWorkspace?) -> [PecalWidgetTask] {
    let tasks = tasksByDayKey(for: workspace)[todayKey] ?? []
    return tasks.sorted { lhs, rhs in
      let l = parseISO(lhs.start_time) ?? .distantPast
      let r = parseISO(rhs.start_time) ?? .distantPast
      return l < r
    }
  }

  @ViewBuilder
  private func mediumWorkspacePage(_ workspace: PecalWidgetWorkspace) -> some View {
    let currentDayTasks = todayTasks(for: workspace)
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text("TODAY")
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(.gray)
        Spacer()
        VStack(alignment: .trailing, spacing: 2) {
          Text(workspace.workspace_name)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Color.gray.opacity(0.9))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
          Text(monthTitle)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Color.black.opacity(0.65))
        }
      }

      if currentDayTasks.isEmpty {
        Text("오늘 일정이 없습니다.")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(.gray)
      } else {
        VStack(alignment: .leading, spacing: 6) {
          ForEach(Array(currentDayTasks.prefix(5)), id: \.id) { task in
            let isDone = task.status.uppercased() == "DONE"
            let showTapFeedback = shouldShowWidgetFeedback(for: task.id)
            HStack(spacing: 8) {
              if #available(iOSApplicationExtension 17.0, *) {
                Button(intent: ToggleTaskCompletionIntent(taskId: task.id, done: !isDone)) {
                  ZStack {
                    Circle()
                      .stroke(showTapFeedback ? Color.orange.opacity(0.65) : Color.clear, lineWidth: 2)
                      .frame(width: 20, height: 20)
                    Circle()
                      .stroke(isDone ? Color.clear : Color.gray.opacity(0.45), lineWidth: 1.2)
                      .frame(width: 16, height: 16)
                    Circle()
                      .fill(isDone ? Color.green.opacity(0.88) : Color.clear)
                      .frame(width: 16, height: 16)
                    if isDone {
                      Image(systemName: "checkmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                    }
                  }
                }
                .buttonStyle(.plain)
              } else {
                Circle()
                  .fill(colorFromHex(task.color))
                  .frame(width: 7, height: 7)
              }
              Text(timeLabel(task))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(primaryTextColor)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .monospacedDigit()
                .frame(width: 86, alignment: .leading)
              Text(task.title)
                .font(.system(size: 12, weight: .bold))
                .lineLimit(1)
                .strikethrough(isDone, color: primaryTextColor.opacity(0.7))
                .foregroundStyle(primaryTextColor)
            }
          }
        }
      }
      Spacer(minLength: 0)
    }
    .padding(12)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private var lockScreenTasks: [PecalWidgetTask] {
    todayTasks(for: activeWorkspace)
  }

  private var closestTask: PecalWidgetTask? {
    let now = Date()
    let datedTasks = lockScreenTasks.compactMap { task -> (PecalWidgetTask, Date, Date)? in
      guard let start = parseISO(task.start_time) else { return nil }
      let end = parseISO(task.end_time) ?? start
      return (task, start, end)
    }

    if let active = datedTasks.first(where: { _, start, end in
      start <= now && end >= now
    }) {
      return active.0
    }

    return datedTasks.min { lhs, rhs in
      let leftDistance = abs(lhs.1.timeIntervalSince(now))
      let rightDistance = abs(rhs.1.timeIntervalSince(now))
      if leftDistance == rightDistance {
        return lhs.1 < rhs.1
      }
      return leftDistance < rightDistance
    }?.0
  }

  @ViewBuilder
  private func accessoryInlineView() -> some View {
    if let task = closestTask {
      Text("\(workspaceName) · \(task.title)")
    } else {
      Text("\(workspaceName) · 오늘 일정 없음")
    }
  }

  @ViewBuilder
  private func accessoryCircularView() -> some View {
    ZStack {
      Circle()
        .fill(Color.blue.opacity(0.14))
      VStack(spacing: 1) {
        Text("\(lockScreenTasks.count)")
          .font(.system(size: 14, weight: .bold))
        Text("TODAY")
          .font(.system(size: 6, weight: .semibold))
      }
      .foregroundStyle(primaryTextColor)
    }
  }

  @ViewBuilder
  private func accessoryRectangularView() -> some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 6) {
        Image(systemName: "calendar")
          .font(.system(size: 11, weight: .semibold))
        Text(workspaceName)
          .font(.system(size: 11, weight: .bold))
          .lineLimit(1)
        Spacer(minLength: 0)
        Text("\(lockScreenTasks.count)개")
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(.secondary)
      }

      if let task = closestTask {
        Text(task.title)
          .font(.system(size: 12, weight: .bold))
          .lineLimit(1)
        Text(timeLabel(task))
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(.secondary)
      } else {
        Text("오늘 일정이 없습니다.")
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(.secondary)
      }
    }
  }

  private func shouldShowWidgetFeedback(for taskId: Int) -> Bool {
    guard entry.payload?.widget_feedback_task_id == taskId else { return false }
    guard let untilRaw = entry.payload?.widget_feedback_until,
          let untilDate = parseISO8601Flexible(untilRaw) else { return false }
    return Date() <= untilDate
  }

  private var deepLinkURL: URL? {
    guard let task = closestTask else { return nil }
    return URL(string: "myapp://tasks/\(task.id)")
  }

  var body: some View {
    if family == .accessoryInline {
      accessoryInlineView()
    } else if family == .accessoryCircular {
      accessoryCircularView()
    } else if family == .accessoryRectangular {
      accessoryRectangularView()
    } else if family == .systemLarge {
      ZStack {
        widgetBgColor

        if displayedWorkspaces.isEmpty {
          VStack(alignment: .leading, spacing: 8) {
            Text(monthTitle)
              .font(.system(size: 19, weight: .bold))
              .foregroundStyle(primaryTextColor)
              .lineLimit(1)
              .minimumScaleFactor(0.8)
            Text("워크스페이스 데이터를 불러오는 중입니다.")
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(.gray)
            Spacer(minLength: 0)
          }
          .padding(10)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else if activeWorkspace == nil {
          VStack(alignment: .leading, spacing: 8) {
            Text(monthTitle)
              .font(.system(size: 19, weight: .bold))
              .foregroundStyle(primaryTextColor)
            Text("위젯 편집에서 워크스페이스를 선택하세요.")
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(.gray)
            Spacer(minLength: 0)
          }
          .padding(10)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else if let workspace = activeWorkspace {
          workspacePage(workspace)
        }
      }
      .containerBackground(for: .widget) {
        widgetBgColor
      }
    } else {
      Group {
        if family == .systemMedium {
          if displayedWorkspaces.isEmpty {
            mediumWorkspacePage(
              PecalWidgetWorkspace(workspace_id: 0, workspace_name: workspaceName, tasks: todayTasks(for: activeWorkspace))
            )
            .containerBackground(for: .widget) { widgetBgColor }
          } else if activeWorkspace == nil {
            VStack(alignment: .leading, spacing: 8) {
              Text("TODAY")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.gray)
              Text("위젯 편집에서 워크스페이스를 선택하세요.")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.gray)
              Spacer(minLength: 0)
            }
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .containerBackground(for: .widget) { widgetBgColor }
          } else if let workspace = activeWorkspace {
            mediumWorkspacePage(workspace)
            .containerBackground(for: .widget) { widgetBgColor }
          }
        } else {
          VStack(alignment: .leading, spacing: 8) {
            Text(monthTitle)
              .font(.headline)
              .fontWeight(.bold)
            Text("Large 위젯에서 월간 일정 디자인이 표시됩니다.")
              .font(.caption2)
              .foregroundStyle(.secondary)
          }
          .padding()
        }
      }
      .widgetURL(deepLinkURL)
    }
  }

  private func workspacePage(_ workspace: PecalWidgetWorkspace) -> some View {
    let layout = monthRenderLayout(for: workspace)
    return VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 2) {
          Text(monthTitle)
            .font(.system(size: 19, weight: .bold))
            .foregroundStyle(primaryTextColor)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
          Text("TODAY")
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(.gray)
        }
        Spacer()
        Text(workspace.workspace_name)
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(secondaryTextColor)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }

      HStack(spacing: 0) {
        ForEach(weekdayLabels, id: \.self) { day in
          Text(day)
            .font(.system(size: 8.5, weight: .bold))
            .foregroundStyle(mutedTextColor)
            .frame(maxWidth: .infinity)
        }
      }

      VStack(spacing: 0) {
        ForEach(Array(dayRows.enumerated()), id: \.offset) { rowIndex, row in
          ZStack(alignment: .topLeading) {
            HStack(spacing: 0) {
              ForEach(row) { cell in
                let dayData: MonthDayRenderData? = {
                  guard let date = cell.date else { return nil }
                  return layout.dayDataByKey[dayKey(date)]
                }()
                dayCellView(cell, dayData: dayData)
              }
            }

            GeometryReader { geo in
              let columnWidth = geo.size.width / 7.0
              ForEach(layout.visibleSegmentsByRow[rowIndex] ?? []) { segment in
                let span = CGFloat(segment.endCol - segment.startCol + 1)
                let left = CGFloat(segment.startCol) * columnWidth + 1
                let width = max(0, span * columnWidth - 2)
                let top = widgetMultiBarTopOffset + CGFloat(segment.lane) * widgetMultiLaneStep
                let showTitle = segment.isStart || segment.startCol == 0

                RoundedRectangle(
                  cornerRadius: segment.isStart || segment.isEnd ? 6 : 2,
                  style: .continuous
                )
                  .fill(colorFromHex(segment.task.color).opacity(0.9))
                  .frame(width: width, height: 9)
                  .overlay(alignment: .leading) {
                    if showTitle {
                      Text(segment.task.title)
                        .font(.system(size: 6.0, weight: .bold))
                        .lineLimit(1)
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, 3)
                    }
                  }
                  .offset(x: left, y: top)
              }
            }
            .allowsHitTesting(false)
          }
        }
      }
    }
    .padding(8)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  @ViewBuilder
  private func dayCellView(_ cell: MonthDayCell, dayData: MonthDayRenderData?) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      if let date = cell.date {
        let key = dayKey(date)
        let isToday = key == todayKey
        let specialDayText = cell.inCurrentMonth ? specialDayLabel(for: date) : nil
        let visibleSingleTasks = dayData?.visibleSingleTasks ?? []
        let hiddenCount = dayData?.hiddenCount ?? 0
        let visibleMultiCount = dayData?.visibleMultiCount ?? 0
        let reservedTopSpacing = visibleMultiCount > 0 ? CGFloat(visibleMultiCount) * widgetMultiLaneStep - 1 : 0

        VStack(alignment: .leading, spacing: 0) {
          dayNumberBadge(day: calendar.component(.day, from: date), isToday: isToday)
          if let specialDayText {
            Text(specialDayText)
              .font(.system(size: widgetSpecialDayFontSize, weight: .bold))
              .lineLimit(1)
              .foregroundStyle(Color.red.opacity(0.9))
              .frame(height: widgetSpecialDayLineHeight, alignment: .leading)
          } else {
            Spacer(minLength: widgetSpecialDayLineHeight)
          }
        }
        .frame(height: widgetDayHeaderHeight, alignment: .topLeading)
        VStack(alignment: .leading, spacing: 1) {
          ForEach(visibleSingleTasks, id: \.id) { task in
          dayTaskChip(task, cellDate: date, cellDateKey: key)
          }
          if hiddenCount > 0 {
            Text("+\(hiddenCount) more")
              .font(.system(size: 7, weight: .semibold))
              .foregroundColor(Color.gray.opacity(0.85))
              .lineLimit(1)
          }
        }
        .padding(.top, reservedTopSpacing)
      }
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 1.5)
    .padding(.vertical, 2)
    .frame(maxWidth: .infinity, minHeight: 46, alignment: .topLeading)
    .background(
      Rectangle().fill(cell.inCurrentMonth ? Color.clear : otherMonthBgColor)
    )
    .overlay(
      Rectangle().stroke(dayBorderColor, lineWidth: 0.5)
    )
  }

  private func specialDayLabel(for date: Date) -> String? {
    let key = dayKey(date)
    return entry.payload?.special_days_by_date?[key]?.first
  }

  private func timeLabel(_ task: PecalWidgetTask) -> String {
    let start = parseISO(task.start_time)
    let end = parseISO(task.end_time)
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "ko_KR")
    formatter.dateFormat = "HH:mm"
    let s = start.map { formatter.string(from: $0) } ?? "--:--"
    let e = end.map { formatter.string(from: $0) } ?? "--:--"
    return "\(s)-\(e)"
  }

  private func dayNumberBadge(day: Int, isToday: Bool) -> some View {
      Text(String(day))
      .font(.system(size: 11, weight: .semibold))
      .foregroundColor(isToday ? .white : primaryTextColor)
      .frame(width: 20, height: 20)
      .background(
        Circle().fill(isToday ? Color.blue.opacity(0.35) : Color.clear)
      )
  }

  private func dayTaskChip(_ task: PecalWidgetTask, cellDate: Date, cellDateKey: String) -> some View {
    let startKey = rawDayKey(task.start_time) ?? parseISO(task.start_time).map(dayKey) ?? ""
    let endKey = rawDayKey(task.end_time) ?? parseISO(task.end_time).map(dayKey) ?? ""
    let isStart = startKey == cellDateKey
    let isEnd = endKey == cellDateKey
    let isSingle = isStart && isEnd
    let isMultiDay = !isSingle
    let isWeekStart = calendar.component(.weekday, from: cellDate) == calendar.firstWeekday
    let showTitle = isSingle || isStart || isWeekStart

    return Text(showTitle ? task.title : " ")
      .font(.system(size: 6.0, weight: .semibold))
      .lineLimit(1)
      .foregroundColor(primaryTextColor)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.leading, isMultiDay && !isStart ? 1 : 4)
      .padding(.trailing, isMultiDay && !isEnd ? 1 : 4)
      .padding(.vertical, 1)
      .background(
        RoundedRectangle(
          cornerSize: CGSize(
            width: isSingle ? 999 : (isStart || isEnd ? 10 : 6),
            height: isSingle ? 999 : (isStart || isEnd ? 10 : 6)
          ),
          style: .continuous
        )
          .fill(colorFromHex(task.color).opacity(0.38))
      )
  }

  private func dayKey(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "ko_KR")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  private func parseISO(_ value: String) -> Date? {
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = parser.date(from: value) {
      return date
    }
    let fallback = ISO8601DateFormatter()
    if let date = fallback.date(from: value) {
      return date
    }

    let df = DateFormatter()
    df.locale = Locale(identifier: "en_US_POSIX")
    df.timeZone = TimeZone.current

    df.dateFormat = "yyyy-MM-dd HH:mm:ss"
    if let date = df.date(from: value) {
      return date
    }
    df.dateFormat = "yyyy-MM-dd HH:mm"
    if let date = df.date(from: value) {
      return date
    }
    df.dateFormat = "yyyy-MM-dd"
    return df.date(from: value)
  }

  private func rawDayKey(_ value: String) -> String? {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.count >= 10 {
      let candidate = String(trimmed.prefix(10))
      if candidate.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil {
        return candidate
      }
    }
    return nil
  }

  private func dedupeTasksByID(_ tasks: [PecalWidgetTask]) -> [PecalWidgetTask] {
    var seen: Set<Int> = []
    var deduped: [PecalWidgetTask] = []
    deduped.reserveCapacity(tasks.count)
    for task in tasks {
      if seen.contains(task.id) { continue }
      seen.insert(task.id)
      deduped.append(task)
    }
    return deduped
  }

  private func colorFromHex(_ hex: String) -> Color {
    var cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if cleaned.hasPrefix("#") { cleaned.removeFirst() }
    guard cleaned.count == 6, let value = Int(cleaned, radix: 16) else {
      return Color.blue
    }
    let r = Double((value >> 16) & 0xFF) / 255.0
    let g = Double((value >> 8) & 0xFF) / 255.0
    let b = Double(value & 0xFF) / 255.0
    return Color(red: r, green: g, blue: b)
  }
}

struct PecalWidgetExtension: Widget {
  let kind = "PecalWidget"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: PecalWidgetProvider()) { entry in
      PecalWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Pecal 일정")
    .description("오늘 일정과 월간 일정을 위젯에서 보여줍니다.")
    .supportedFamilies([.systemMedium, .systemLarge, .accessoryInline, .accessoryCircular, .accessoryRectangular])
  }
}

func loadPecalWidgetPayload() -> PecalWidgetPayload? {
  guard
    let defaults = UserDefaults(suiteName: pecalWidgetSuiteName),
    let raw = defaults.string(forKey: pecalWidgetStorageKey),
    let data = raw.data(using: .utf8)
  else { return nil }

  return try? JSONDecoder().decode(PecalWidgetPayload.self, from: data)
}

func savePecalWidgetPayload(_ payload: PecalWidgetPayload) {
  guard let defaults = UserDefaults(suiteName: pecalWidgetSuiteName),
        let data = try? JSONEncoder().encode(payload),
        let json = String(data: data, encoding: .utf8)
  else { return }
  defaults.set(json, forKey: pecalWidgetStorageKey)
  defaults.synchronize()
}

func resolvePecalWidgetPayload() async -> PecalWidgetPayload? {
  guard let current = loadPecalWidgetPayload() else { return nil }
  if let skipUntilRaw = current.widget_skip_network_until,
     let skipUntil = parseISO8601Flexible(skipUntilRaw),
     Date() <= skipUntil {
    return current
  }
  // If payload was updated moments ago (e.g., widget checkbox interaction),
  // render immediately from local cache instead of waiting for network sync.
  if let generatedAt = parseISO8601Flexible(current.generated_at) {
    if Date().timeIntervalSince(generatedAt) < 30 {
      return current
    }
  }
  guard
    let baseURLRaw = current.api_base_url?.trimmingCharacters(in: .whitespacesAndNewlines),
    !baseURLRaw.isEmpty,
    !current.workspaces.isEmpty
  else {
    return current
  }

  let baseURL = baseURLRaw.hasSuffix("/") ? String(baseURLRaw.dropLast()) : baseURLRaw
  var accessToken = current.access_token ?? ""

  func fetchWorkspaceTasks(token: String, workspaceId: Int) async throws -> [PecalWidgetTask] {
    guard let url = URL(string: "\(baseURL)/api/tasks?workspace_id=\(workspaceId)&limit=200&sort_by=start_time&sort_order=ASC") else {
      return []
    }
    var req = URLRequest(url: url)
    req.timeoutInterval = 4
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    let (data, response) = try await URLSession.shared.data(for: req)
    guard let http = response as? HTTPURLResponse else { return [] }
    if http.statusCode == 401 {
      throw NSError(domain: "pecal.widget.auth", code: 401)
    }
    guard (200..<300).contains(http.statusCode) else { return [] }
    let decoded = try JSONDecoder().decode(PecalTasksResponse.self, from: data)
    return decoded.tasks ?? []
  }

  var updatedWorkspaces: [PecalWidgetWorkspace] = []
  updatedWorkspaces.reserveCapacity(current.workspaces.count)

  for workspace in current.workspaces {
    do {
      let tasks = try await fetchWorkspaceTasks(token: accessToken, workspaceId: workspace.workspace_id)
      updatedWorkspaces.append(
        PecalWidgetWorkspace(
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.workspace_name,
          tasks: tasks
        )
      )
    } catch {
      // Widget must not rotate auth tokens independently from the app session.
      updatedWorkspaces.append(workspace)
    }
  }

  let selectedTasks = updatedWorkspaces.first?.tasks ?? current.tasks
  let merged = PecalWidgetPayload(
    generated_at: ISO8601DateFormatter().string(from: Date()),
    nickname: current.nickname,
    theme: current.theme,
    api_base_url: current.api_base_url,
    access_token: accessToken.isEmpty ? current.access_token : accessToken,
    refresh_token: nil,
    member_id: current.member_id,
    workspace_name: current.workspace_name,
    tasks: selectedTasks,
    workspaces: updatedWorkspaces,
    special_days_by_date: current.special_days_by_date,
    widget_feedback_task_id: current.widget_feedback_task_id,
    widget_feedback_until: current.widget_feedback_until,
    widget_skip_network_until: current.widget_skip_network_until
  )

  savePecalWidgetPayload(merged)
  return merged
}

private func parseISO8601Flexible(_ raw: String) -> Date? {
  if raw.isEmpty { return nil }
  let plain = ISO8601DateFormatter()
  plain.formatOptions = [.withInternetDateTime]
  if let parsed = plain.date(from: raw) { return parsed }

  let fractional = ISO8601DateFormatter()
  fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return fractional.date(from: raw)
}
