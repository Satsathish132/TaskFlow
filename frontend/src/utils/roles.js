export const ROLE_RANK = { SUPER_ADMIN: 4, ADMIN: 3, SUB_ADMIN: 2, MEMBER: 1 };

export const ROLE_LABEL = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SUB_ADMIN: "Sub Admin",
  MEMBER: "Member",
};

export const can = {
  createWorkspace: (role) => ["SUPER_ADMIN", "ADMIN"].includes(role),
  createOrgUser: (role) => ["SUPER_ADMIN", "ADMIN"].includes(role),
  changeAnyRole: (role) => role === "SUPER_ADMIN",
  removeWorkspaceMember: (role) => ["SUPER_ADMIN", "ADMIN"].includes(role),
  createProject: (role) => ["SUPER_ADMIN", "ADMIN"].includes(role),
  createTask: (role) => ["SUPER_ADMIN", "ADMIN", "MEMBER"].includes(role),
  updateTaskStatus: () => true,
  addWorkspaceMember: (role) => ["SUPER_ADMIN", "ADMIN", "SUB_ADMIN"].includes(role),
  // Mirrors projectRoutes.js: permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN") on /projects/assign and /projects/remove
  manageProjectMembers: (role) => ["SUPER_ADMIN", "ADMIN", "SUB_ADMIN"].includes(role),
};

// An admin acting on a workspace member can't touch equal/higher rank
// (mirrors userController's ROLE_RANK comparison).
export const canActOnRole = (actorRole, targetRole) =>
  ROLE_RANK[actorRole] > ROLE_RANK[targetRole];

// Which roles an actor is allowed to SET someone to, org-wide (Team page).
// SUPER_ADMIN: anything except another SUPER_ADMIN.
// ADMIN: can only promote/demote between SUB_ADMIN and MEMBER — never ADMIN.
// SUB_ADMIN / MEMBER: can't promote anyone at all.
export const getAssignableRoles = (actorRole) => {
  if (actorRole === "SUPER_ADMIN") return ["ADMIN", "SUB_ADMIN", "MEMBER"];
  if (actorRole === "ADMIN") return ["SUB_ADMIN", "MEMBER"];
  return [];
};

// Mirrors memberController.removeMember exactly: no one can remove a
// SUPER_ADMIN, and an ADMIN can only remove SUB_ADMIN/MEMBER.
export const canRemoveWorkspaceMember = (actorRole, targetRole) => {
  if (!["SUPER_ADMIN", "ADMIN"].includes(actorRole)) return false;
  if (targetRole === "SUPER_ADMIN") return false;
  if (actorRole === "ADMIN" && ["SUPER_ADMIN", "ADMIN"].includes(targetRole)) return false;
  return true;
};
