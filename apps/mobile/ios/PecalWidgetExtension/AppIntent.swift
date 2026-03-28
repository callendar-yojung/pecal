//
//  AppIntent.swift
//  PecalWidgetExtension
//
//  Created by 장사장 on 2/23/26.
//

import WidgetKit
import AppIntents
import Foundation

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Pecal Widget" }
    static var description: IntentDescription { "표시할 워크스페이스를 선택합니다." }

    @Parameter(title: "워크스페이스")
    var workspace: WorkspaceEntity?

    static var parameterSummary: some ParameterSummary {
      Summary("워크스페이스: \(\.$workspace)")
    }
}

struct WorkspaceEntity: AppEntity, Identifiable {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Workspace")
  static var defaultQuery = WorkspaceEntityQuery()

  let id: Int
  let name: String
  let taskCount: Int

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(
      title: "\(name)",
      subtitle: "\(taskCount) tasks"
    )
  }
}

struct WorkspaceEntityQuery: EntityQuery {
  func entities(for identifiers: [WorkspaceEntity.ID]) async throws -> [WorkspaceEntity] {
    let all = loadWorkspaceEntities()
    let idSet = Set(identifiers)
    return all.filter { idSet.contains($0.id) }
  }

  func suggestedEntities() async throws -> [WorkspaceEntity] {
    loadWorkspaceEntities()
  }
}

private func loadWorkspaceEntities() -> [WorkspaceEntity] {
  guard let payload = loadPecalWidgetPayload() else { return [] }
  return payload.workspaces.map { workspace in
    WorkspaceEntity(
      id: workspace.workspace_id,
      name: workspace.workspace_name,
      taskCount: workspace.tasks.count
    )
  }
}

struct ToggleTaskCompletionIntent: AppIntent {
  static var title: LocalizedStringResource { "일정 완료 토글" }
  static var description = IntentDescription("위젯에서 일정을 완료/미완료로 전환합니다.")
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Task ID")
  var taskId: Int

  @Parameter(title: "Done")
  var done: Bool

  init() {}

  init(taskId: Int, done: Bool) {
    self.taskId = taskId
    self.done = done
  }

  func perform() async throws -> some IntentResult {
    guard let current = loadPecalWidgetPayload() else { return .result() }
    let newStatus = done ? "DONE" : "TODO"
    let merged = mergedPayload(from: current, taskId: taskId, newStatus: newStatus)
    savePecalWidgetPayload(merged)
    WidgetCenter.shared.reloadTimelines(ofKind: "PecalWidget")
    WidgetCenter.shared.reloadAllTimelines()

    // Sync to server asynchronously so widget tap feels immediate.
    if let baseURLRaw = current.api_base_url?.trimmingCharacters(in: .whitespacesAndNewlines),
       !baseURLRaw.isEmpty,
       let token = current.access_token,
       !token.isEmpty {
      let baseURL = baseURLRaw.hasSuffix("/") ? String(baseURLRaw.dropLast()) : baseURLRaw
      Task.detached {
        guard let url = URL(string: "\(baseURL)/api/tasks") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.timeoutInterval = 4
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(
          withJSONObject: [
            "task_id": taskId,
            "status": newStatus,
          ],
          options: []
        )
        _ = try? await URLSession.shared.data(for: request)
      }
    }

    return .result()
  }

  private func mergedPayload(from current: PecalWidgetPayload, taskId: Int, newStatus: String) -> PecalWidgetPayload {
    let now = Date()
    let formatter = ISO8601DateFormatter()
    let feedbackUntil = formatter.string(from: now.addingTimeInterval(3))
    let skipUntil = formatter.string(from: now.addingTimeInterval(120))
    let updatedWorkspaces = current.workspaces.map { workspace in
      PecalWidgetWorkspace(
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        tasks: workspace.tasks.map { task in
          guard task.id == taskId else { return task }
          return PecalWidgetTask(
            id: task.id,
            title: task.title,
            start_time: task.start_time,
            end_time: task.end_time,
            status: newStatus,
            color: task.color
          )
        }
      )
    }

    let updatedLegacyTasks = current.tasks?.map { task in
      guard task.id == taskId else { return task }
      return PecalWidgetTask(
        id: task.id,
        title: task.title,
        start_time: task.start_time,
        end_time: task.end_time,
        status: newStatus,
        color: task.color
      )
    }

    return PecalWidgetPayload(
      generated_at: formatter.string(from: now),
      nickname: current.nickname,
      theme: current.theme,
      api_base_url: current.api_base_url,
      access_token: current.access_token,
      refresh_token: current.refresh_token,
      member_id: current.member_id,
      workspace_name: current.workspace_name,
      tasks: updatedLegacyTasks,
      workspaces: updatedWorkspaces,
      special_days_by_date: current.special_days_by_date,
      widget_feedback_task_id: taskId,
      widget_feedback_until: feedbackUntil,
      widget_skip_network_until: skipUntil
    )
  }
}
