// @ts-expect-error - JS axios instance
import api from "@/lib/api";

type ToolInput = Record<string, unknown>;
type NavigateFn = (path: string) => void;

const s = (v: unknown) => (v == null ? undefined : String(v));

/**
 * Executes an agent tool client-side against the geoq backend using the
 * existing authenticated axios client. Returns a compact, serialisable result.
 */
export async function executeAgentTool(
  toolName: string,
  input: ToolInput,
  navigate: NavigateFn,
): Promise<unknown> {
  try {
    switch (toolName) {
      case "navigate": {
        const path = s(input.path) || "/dashboard";
        navigate(path);
        return { ok: true, navigatedTo: path };
      }

      case "list_workspaces": {
        const { data } = await api.get("/workspaces/my");
        return { workspaces: data };
      }

      case "list_projects": {
        const { data } = await api.get(`/projects/${s(input.workspaceId)}`);
        return { projects: data };
      }

      case "list_tasks": {
        const { data } = await api.get(`/tasks/${s(input.workspaceId)}`);
        const projectId = s(input.projectId);
        const tasks = projectId
          ? (data as any[]).filter((t) => String(t.project_id) === projectId)
          : data;
        return { tasks };
      }

      case "create_task": {
        const { data } = await api.post("/tasks/create", {
          workspaceId: s(input.workspaceId),
          projectId: s(input.projectId),
          title: s(input.title),
          description: s(input.description),
          priority: s(input.priority) || "MEDIUM",
          assignedTo: s(input.assignedTo),
        });
        return { ok: true, task: data };
      }

      case "update_task_status": {
        const { data } = await api.put("/tasks/status", {
          taskId: s(input.taskId),
          status: s(input.status),
          workspaceId: s(input.workspaceId),
        });
        return { ok: true, result: data ?? "updated" };
      }

      case "list_org_users": {
        const { data } = await api.get("/users/");
        return { users: data };
      }

      case "list_workspace_members": {
        const { data } = await api.get(`/members/${s(input.workspaceId)}`);
        return { members: data };
      }

      case "add_workspace_member": {
        const { data } = await api.post("/members/add-existing", {
          workspaceId: s(input.workspaceId),
          userId: s(input.userId),
        });
        return { ok: true, result: data ?? "added" };
      }

      case "remove_workspace_member": {
        const { data } = await api.delete("/members/remove", {
          data: { workspaceId: s(input.workspaceId), userId: s(input.userId) },
        });
        return { ok: true, result: data ?? "removed" };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    return {
      error:
        err?.response?.data?.message ||
        err?.message ||
        "The request to the backend failed.",
    };
  }
}

export const TOOL_LABELS: Record<string, string> = {
  navigate: "Navigating",
  list_workspaces: "Reading workspaces",
  list_projects: "Reading projects",
  list_tasks: "Reading tasks",
  create_task: "Creating task",
  update_task_status: "Updating task",
  list_org_users: "Reading users",
  list_workspace_members: "Reading members",
  add_workspace_member: "Adding member",
  remove_workspace_member: "Removing member",
};
