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
    formatter.locale = Locale(identifier: "ko_KR")
    formatter.dateFormat = "yyyy년 M월"
    return formatter.string(from: entry.date)
  }

  private var dayCells: [MonthDayCell] {
    let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: entry.date)) ?? entry.date
    let firstWeekday = calendar.component(.weekday, from: startOfMonth)
    let leading = (firstWeekday - calendar.firstWeekday + 7) % 7
    let daysInMonth = calendar.range(of: .day, in: .month, for: startOfMonth)?.count ?? 30

    var cells: [MonthDayCell] = []
    cells.reserveCapacity(42)

    for index in 0..<42 {
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
      guard let start = parseISO(task.start_time) else { continue }
      let key = dayKey(start)
      grouped[key, default: []].append(task)
    }
    return grouped.mapValues { tasksInDay in
      tasksInDay.sorted { lhs, rhs in
        (parseISO(lhs.start_time) ?? .distantPast) < (parseISO(rhs.start_time) ?? .distantPast)
      }
    }
  }

  var body: some View {
    if family == .systemLarge {
      VStack(alignment: .leading, spacing: 8) {
        HStack(spacing: 8) {
          Text(monthTitle)
            .font(.headline)
            .fontWeight(.bold)
          Spacer(minLength: 6)
          Text(entry.payload?.workspace_name ?? "Pecal")
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }

        HStack(spacing: 0) {
          ForEach(["일", "월", "화", "수", "목", "금", "토"], id: \.self) { label in
            Text(label)
              .font(.caption2)
              .fontWeight(.semibold)
              .foregroundStyle(.secondary)
              .frame(maxWidth: .infinity)
          }
        }

        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
          ForEach(dayCells) { cell in
            dayCellView(cell)
          }
        }
      }
      .padding(10)
      .background(Color(.systemBackground))
    } else {
      VStack(alignment: .leading, spacing: 6) {
        Text(monthTitle)
          .font(.headline)
          .fontWeight(.semibold)
        Text("대형 위젯으로 추가하면 월간 캘린더와 일정 목록을 볼 수 있습니다.")
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
        Text(String(calendar.component(.day, from: date)))
          .font(.caption2)
          .fontWeight(.bold)
          .foregroundStyle(.primary)

        let dayTasks = tasksByDayKey[dayKey(date)] ?? []
        ForEach(Array(dayTasks.prefix(2).enumerated()), id: \.element.id) { _, task in
          HStack(spacing: 2) {
            Circle()
              .fill(colorFromHex(task.color))
              .frame(width: 4, height: 4)
            Text(task.title)
              .font(.system(size: 8, weight: .semibold))
              .lineLimit(1)
              .foregroundStyle(.primary)
          }
        }
      } else {
        Spacer(minLength: 0)
      }
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 3)
    .padding(.vertical, 2)
    .frame(minHeight: 44, maxHeight: .infinity, alignment: .topLeading)
    .background(
      RoundedRectangle(cornerRadius: 6)
        .fill(cell.inCurrentMonth ? Color(.secondarySystemBackground) : Color.clear)
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
    return fallback.date(from: value)
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
    .supportedFamilies([.systemLarge])
  }
}
