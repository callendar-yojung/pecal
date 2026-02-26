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

private struct MonthDayCell: Identifiable {
  let id: Int
  let date: Date?
  let inCurrentMonth: Bool
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
  @Environment(\.widgetFamily) private var family

  private var calendar: Calendar {
    var cal = Calendar(identifier: .gregorian)
    cal.locale = Locale(identifier: "ko_KR")
    cal.timeZone = TimeZone.current
    return cal
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

  private var tasksByDayKey: [String: [PecalWidgetTask]] {
    let tasks = entry.payload?.tasks ?? []
    var grouped: [String: [PecalWidgetTask]] = [:]

    for task in tasks {
      let key = rawDayKey(task.start_time) ?? {
        guard let start = parseISO(task.start_time) else { return nil }
        return dayKey(start)
      }()
      guard let key else { continue }
      grouped[key, default: []].append(task)
    }

    return grouped.mapValues { tasksInDay in
      tasksInDay.sorted { lhs, rhs in
        let l = parseISO(lhs.start_time) ?? .distantPast
        let r = parseISO(rhs.start_time) ?? .distantPast
        return l < r
      }
    }
  }

  private var todayTasks: [PecalWidgetTask] {
    let tasks = tasksByDayKey[todayKey] ?? []
    return tasks.sorted { lhs, rhs in
      let l = parseISO(lhs.start_time) ?? .distantPast
      let r = parseISO(rhs.start_time) ?? .distantPast
      return l < r
    }
  }

  var body: some View {
    if family == .systemLarge {
      ZStack {
        Color.white

        VStack(alignment: .leading, spacing: 8) {
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
                  dayCellView(cell)
                }
              }
            }
          }
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
      .containerBackground(for: .widget) {
        Color.white
      }
    } else if family == .systemMedium {
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text("TODAY")
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(.gray)
          Spacer()
          Text(monthTitle)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Color.black.opacity(0.65))
        }

        if todayTasks.isEmpty {
          Text("오늘 일정이 없습니다.")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.gray)
        } else {
          VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(todayTasks.prefix(5)), id: \.id) { task in
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
      .containerBackground(for: .widget) { Color.white }
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

  @ViewBuilder
  private func dayCellView(_ cell: MonthDayCell) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      if let date = cell.date {
        let key = dayKey(date)
        let isToday = key == todayKey

        dayNumberBadge(day: calendar.component(.day, from: date), isToday: isToday)
        let dayTasks = tasksByDayKey[key] ?? []
        if let firstTask = dayTasks.first {
          dayTaskChip(firstTask)
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

  private func dayTaskChip(_ task: PecalWidgetTask) -> some View {
    Text(task.title)
      .font(.system(size: 7.6, weight: .bold))
      .lineLimit(1)
      .minimumScaleFactor(0.6)
      .foregroundColor(Color.black.opacity(0.72))
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 4)
      .padding(.vertical, 2)
      .background(
        RoundedRectangle(cornerRadius: 6, style: .continuous)
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
    StaticConfiguration(kind: kind, provider: PecalWidgetProvider()) { entry in
      PecalWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Pecal 일정")
    .description("현재 달 캘린더와 일정 제목을 색상과 함께 보여줍니다.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}
