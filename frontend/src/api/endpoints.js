import api from "../lib/api";

export const memberApi = {
  list: (workspaceId) => api.get(`/members/${workspaceId}`).then((r) => r.data),
  // Assign an existing org member straight into a workspace — this is
  // what backs the "assign team member" picker. No email/token invite.
  addExisting: (workspaceId, userId) =>
    api.post("/members/add-existing", { workspaceId, userId }).then((r) => r.data),
  changeRole: (workspaceId, userId, role) =>
    api.put("/members/role", { workspaceId, userId, role }).then((r) => r.data),
  remove: (workspaceId, userId) =>
    api.delete("/members/remove", { data: { workspaceId, userId } }).then((r) => r.data),
};

export const userApi = {
  orgUsers: () => api.get("/users/").then((r) => r.data),
};

// Project-level membership — assigns someone already in the workspace
// onto a specific project, mirroring projectController.assignMember.
export const projectApi = {
  members: (projectId) => api.get(`/projects/members/${projectId}`).then((r) => r.data),
  assign: (projectId, userId, workspaceId) =>
    api.post("/projects/assign", { projectId, userId, workspaceId }).then((r) => r.data),
  remove: (projectId, userId, workspaceId) =>
    api.delete("/projects/remove", { data: { projectId, userId, workspaceId } }).then((r) => r.data),
};
