import WidgetKit
import SwiftUI
import AppIntents

let pecalWidgetSuiteName = "group.site.pecal.app"
let pecalWidgetStorageKey = "pecal_widget_payload"

struct PecalWidgetTask: Decodable {
  let id: Int
  let title: String
  let start_time: String
  let end_time: String
  let status: String
  let color: String
}

struct PecalWidgetWorkspace: Decodable {
  let workspace_id: Int
  let workspace_name: String
  let tasks: [PecalWidgetTask]
}

struct PecalWidgetPayload: Decodable {
  let generated_at: String
  let nickname: String
  let workspace_name: String?
  let tasks: [PecalWidgetTask]?
  let workspaces: [PecalWidgetWorkspace]

  private enum CodingKeys: String, CodingKey {
    case generated_at
    case nickname
    case workspaces
    case workspace_name
    case tasks
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    generated_at = try container.decodeIfPresent(String.self, forKey: .generated_at) ?? ""
    nickname = try container.decodeIfPresent(String.self, forKey: .nickname) ?? "Pecal"
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

struct PecalWidgetProvider: AppIntentTimelineProvider {
  typealias Intent = ConfigurationAppIntent

  func placeholder(in context: Context) -> PecalWidgetEntry {
    PecalWidgetEntry(date: .now, payload: nil, selectedWorkspaceId: nil)
  }

  func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> PecalWidgetEntry {
    PecalWidgetEntry(
      date: .now,
      payload: loadPecalWidgetPayload(),
      selectedWorkspaceId: configuration.workspace?.id
    )
  }

  func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<PecalWidgetEntry> {
    let entry = PecalWidgetEntry(
      date: .now,
      payload: loadPecalWidgetPayload(),
      selectedWorkspaceId: configuration.workspace?.id
    )
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: .now) ?? .now.addingTimeInterval(900)
    return Timeline(entries: [entry], policy: .after(next))
  }
}

struct PecalWidgetEntryView: View {
  var entry: PecalWidgetProvider.Entry
  @Environment(\.widgetFamily) private var family

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
            HStack(spacing: 8) {
              Circle()
                .fill(colorFromHex(task.color))
                .frame(width: 7, height: 7)
              Text(timeLabel(task))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.black.opacity(0.7))
                .frame(width: 68, alignment: .leading)
              Text(task.title)
                .font(.system(size: 12, weight: .bold))
                .lineLimit(1)
                .foregroundStyle(Color.black.opacity(0.85))
            }
          }
        }
      }
      Spacer(minLength: 0)
    }
    .padding(12)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  var body: some View {
    if family == .systemLarge {
      ZStack {
        Color.white

        if displayedWorkspaces.isEmpty {
          VStack(alignment: .leading, spacing: 8) {
            Text(monthTitle)
              .font(.system(size: 19, weight: .bold))
              .foregroundStyle(Color.black.opacity(0.72))
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
              .foregroundStyle(Color.black.opacity(0.72))
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
        Color.white
      }
    } else if family == .systemMedium {
      if displayedWorkspaces.isEmpty {
        mediumWorkspacePage(
          PecalWidgetWorkspace(workspace_id: 0, workspace_name: workspaceName, tasks: todayTasks(for: activeWorkspace))
        )
        .containerBackground(for: .widget) { Color.white }
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
        .containerBackground(for: .widget) { Color.white }
      } else if let workspace = activeWorkspace {
        mediumWorkspacePage(workspace)
        .containerBackground(for: .widget) { Color.white }
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

  private func workspacePage(_ workspace: PecalWidgetWorkspace) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 2) {
          Text(monthTitle)
            .font(.system(size: 19, weight: .bold))
            .foregroundStyle(Color.black.opacity(0.72))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
          Text("TODAY")
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(.gray)
        }
        Spacer()
        Text(workspace.workspace_name)
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(Color.gray.opacity(0.9))
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }

      HStack(spacing: 0) {
        ForEach(weekdayLabels, id: \.self) { day in
          Text(day)
            .font(.system(size: 8.5, weight: .bold))
            .foregroundStyle(.gray)
            .frame(maxWidth: .infinity)
        }
      }

      VStack(spacing: 0) {
        ForEach(Array(dayRows.enumerated()), id: \.offset) { _, row in
          HStack(spacing: 0) {
            ForEach(row) { cell in
              dayCellView(cell, workspace: workspace)
            }
          }
        }
      }
    }
    .padding(8)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  @ViewBuilder
  private func dayCellView(_ cell: MonthDayCell, workspace: PecalWidgetWorkspace?) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      if let date = cell.date {
        let key = dayKey(date)
        let isToday = key == todayKey

        dayNumberBadge(day: calendar.component(.day, from: date), isToday: isToday)
        let dayTasks = tasksByDayKey(for: workspace)[key] ?? []
        if let firstTask = dayTasks.first {
          dayTaskChip(firstTask, cellDateKey: key)
        }
        if dayTasks.count > 1 {
          Text("+\(dayTasks.count - 1) more")
            .font(.system(size: 7, weight: .semibold))
            .foregroundColor(Color.gray.opacity(0.85))
            .lineLimit(1)
        }
      }
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 3)
    .padding(.vertical, 2)
    .frame(maxWidth: .infinity, minHeight: 46, alignment: .topLeading)
    .background(
      Rectangle().fill(cell.inCurrentMonth ? Color.clear : Color.white.opacity(0.14))
    )
    .overlay(
      Rectangle().stroke(Color.gray.opacity(0.16), lineWidth: 0.5)
    )
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
      .foregroundColor(isToday ? .white : Color.black.opacity(0.65))
      .frame(width: 20, height: 20)
      .background(
        Circle().fill(isToday ? Color.blue.opacity(0.35) : Color.clear)
      )
  }

  private func dayTaskChip(_ task: PecalWidgetTask, cellDateKey: String) -> some View {
    let startKey = rawDayKey(task.start_time) ?? parseISO(task.start_time).map(dayKey) ?? ""
    let endKey = rawDayKey(task.end_time) ?? parseISO(task.end_time).map(dayKey) ?? ""
    let isStart = startKey == cellDateKey
    let isEnd = endKey == cellDateKey
    let isSingle = isStart && isEnd

    return Text(task.title)
      .font(.system(size: 7.6, weight: .bold))
      .lineLimit(1)
      .minimumScaleFactor(0.6)
      .foregroundColor(Color.black.opacity(0.72))
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 4)
      .padding(.vertical, 2)
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
    .description("현재 달 캘린더와 일정 제목을 색상과 함께 보여줍니다.")
    .supportedFamilies([.systemMedium, .systemLarge])
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
