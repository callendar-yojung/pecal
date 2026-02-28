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
