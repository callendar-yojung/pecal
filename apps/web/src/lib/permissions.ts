export type PermissionDefinition = {
  code: string;
  labelKey: string;
  description: string;
};

export const PERMISSIONS: PermissionDefinition[] = [
  {
    code: "TASK_CREATE",
    labelKey: "permCreate",
    description: "Create tasks",
  },
  {
    code: "TASK_EDIT_OWN",
    labelKey: "permEditOwn",
    description: "Edit own tasks",
  },
  {
    code: "TASK_EDIT_ALL",
    labelKey: "permEditAll",
    description: "Edit all tasks",
  },
  {
    code: "TASK_DELETE_OWN",
    labelKey: "permDeleteOwn",
    description: "Delete own tasks",
  },
  {
    code: "TASK_DELETE_ALL",
    labelKey: "permDeleteAll",
    description: "Delete all tasks",
  },
  {
    code: "WORKSPACE_CREATE",
    labelKey: "permWorkspaceCreate",
    description: "Create workspaces",
  },
  {
    code: "WORKSPACE_EDIT",
    labelKey: "permWorkspaceEdit",
    description: "Edit workspaces",
  },
  {
    code: "WORKSPACE_DELETE",
    labelKey: "permWorkspaceDelete",
    description: "Delete workspaces",
  },
];

export const PERMISSION_CODE_SET = new Set(
  PERMISSIONS.map((permission) => permission.code)
);

export function isValidPermissionCode(code: string) {
  return PERMISSION_CODE_SET.has(code);
}
