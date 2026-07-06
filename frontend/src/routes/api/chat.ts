import { createFileRoute } from "@tanstack/react-router";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";

const SYSTEM_PROMPT = `You are Flow, the built-in AI assistant and agent for Taskflow — a team task and project management app.

You help users understand and act on their workspaces, projects, tasks, comments, team members, and notifications. You are proactive, accurate, and concise.

## How Taskflow is organised
- An **Organization** is the top-level tenant. Everyone in it shares the same pool of users.
- **Workspaces** belong to an organization. **Projects** belong to a workspace. **Tasks** belong to a project (or can sit directly in a workspace with no project).
- **Tasks** have a status — TODO, IN_PROGRESS, DONE — and a priority — LOW, MEDIUM, HIGH. Tasks can have an assignee and a thread of comments.
- **Activity** is a per-user, per-workspace log of actions taken (created a task, changed a status, invited someone, etc.).
- **Notifications** are pushed to a user when something relevant happens to them (assigned a task, added to a workspace, invited, etc.) and can be marked read.

## Roles and permissions
Roles form a strict hierarchy, highest to lowest: **SUPER_ADMIN > ADMIN > SUB_ADMIN > MEMBER**.
- **SUPER_ADMIN**: the organization's owner (the person who registered it). Can do everything, including changing anyone's role and inviting new org users at any level below them.
- **ADMIN**: can create projects, manage workspace membership, remove most members, invite org users below their rank.
- **SUB_ADMIN**: can be added to workspaces and assigned tasks, has limited management rights (no project creation, no removing members), can still invite org users below their rank.
- **MEMBER**: can be assigned tasks, comment, and update task status, but cannot manage members, projects, or roles.
- A rule of thumb you should mention when relevant: a role can only invite, assign, or change the role of someone *strictly below* them in the hierarchy — never equal or higher.
- People join an organization only by being invited (there's no open self-signup except the very first person, who becomes SUPER_ADMIN when they register and create the organization). People join a *workspace* by being assigned in from the org's existing user list — not by a separate email invite.

## Working with tools
- Before calling any tool that requires a workspaceId or projectId, you MUST call list_workspaces (and list_projects if needed) first to get real IDs. NEVER invent, guess, or use placeholder values like "my_workspace", "default", or "current" — if you don't have a real ID, call the listing tool first.
- IDs (workspaceId, projectId, taskId, userId, notificationId) are for your internal use when calling tools — never show them to the user. Refer to things by their name instead (workspace name, project name, task title, person's full name). If two items share a name, disambiguate with distinguishing details (e.g. "the 'hi' workspace with 1 project" vs "the 'hi' workspace with 7 projects") rather than printing an ID.
- When the user asks to create or change something, use the matching tool. After a write tool succeeds, confirm what changed in plain language.`;

const taskStatus = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
const taskPriority = z.enum(["LOW", "MEDIUM", "HIGH"]);
const orgRole = z.enum(["ADMIN", "SUB_ADMIN", "MEMBER"]);
const workspaceRole = z.enum(["ADMIN", "SUB_ADMIN", "MEMBER"]);

// Tools are declared with schemas only (no execute) so they run client-side,
// where the auth token and axios client already live.
const tools = {
  // ── Workspaces ────────────────────────────────────────────────
  list_workspaces: tool({
    description: "List the workspaces the current user belongs to, including their role in each.",
    inputSchema: z.object({}),
  }),
  create_workspace: tool({
    description: "Create a new workspace in the current organization. The creator is automatically added as a member.",
    inputSchema: z.object({
      name: z.string(),
      description: z.string().optional(),
    }),
  }),

  // ── Projects ──────────────────────────────────────────────────
  list_projects: tool({
    description: "List projects in a workspace, including task counts per project.",
    inputSchema: z.object({ workspaceId: z.string() }),
  }),
  create_project: tool({
    description: "Create a project inside a workspace. Requires ADMIN or SUPER_ADMIN.",
    inputSchema: z.object({
      workspaceId: z.string(),
      name: z.string(),
      description: z.string().optional(),
    }),
  }),
  list_project_members: tool({
    description: "List the members assigned to a specific project.",
    inputSchema: z.object({ projectId: z.string() }),
  }),
  assign_project_member: tool({
    description: "Add a workspace member to a project. The user must already be a member of the project's workspace.",
    inputSchema: z.object({
      projectId: z.string(),
      workspaceId: z.string(),
      userId: z.string(),
    }),
  }),
  remove_project_member: tool({
    description: "Remove a member from a project (does not remove them from the workspace).",
    inputSchema: z.object({
      projectId: z.string(),
      workspaceId: z.string(),
      userId: z.string(),
    }),
  }),

  // ── Tasks ─────────────────────────────────────────────────────
  list_tasks: tool({
    description: "List tasks in a workspace, optionally filtered to one project.",
    inputSchema: z.object({
      workspaceId: z.string(),
      projectId: z.string().optional(),
    }),
  }),
  create_task: tool({
    description: "Create a task inside a project, or directly in a workspace if projectId is omitted.",
    inputSchema: z.object({
      workspaceId: z.string(),
      projectId: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      priority: taskPriority.optional(),
      assignedTo: z.string().optional(),
    }),
  }),
  update_task: tool({
    description: "Edit a task's title, description, priority, or assignee.",
    inputSchema: z.object({
      taskId: z.string(),
      workspaceId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: taskPriority.optional(),
      assignedTo: z.string().optional(),
    }),
  }),
  update_task_status: tool({
    description: "Move a task to a new status (TODO, IN_PROGRESS, DONE).",
    inputSchema: z.object({
      taskId: z.string(),
      status: taskStatus,
      workspaceId: z.string(),
    }),
  }),
  delete_task: tool({
    description: "Permanently delete a task.",
    inputSchema: z.object({
      taskId: z.string(),
      workspaceId: z.string(),
    }),
  }),

  // ── Comments ──────────────────────────────────────────────────
  list_comments: tool({
    description: "List the comment thread on a task.",
    inputSchema: z.object({
      workspaceId: z.string(),
      taskId: z.string(),
    }),
  }),
  add_comment: tool({
    description: "Post a comment on a task.",
    inputSchema: z.object({
      workspaceId: z.string(),
      taskId: z.string(),
      comment: z.string(),
    }),
  }),

  // ── Activity & notifications ─────────────────────────────────
  list_activity: tool({
    description: "List the current user's recent activity in a workspace (most recent 50 actions).",
    inputSchema: z.object({ workspaceId: z.string() }),
  }),
  list_notifications: tool({
    description: "List the current user's notifications.",
    inputSchema: z.object({}),
  }),
  mark_notification_read: tool({
    description: "Mark a single notification as read.",
    inputSchema: z.object({ notificationId: z.string() }),
  }),

  // ── Organization & workspace members ─────────────────────────
  list_org_users: tool({
    description: "List all users in the organisation (for assignment or member management).",
    inputSchema: z.object({}),
  }),
  invite_org_user: tool({
    description:
      "Invite a new person into the organization by email. The inviter can only assign a role strictly below their own. Optionally drops the invitee straight into a workspace once they accept.",
    inputSchema: z.object({
      first_name: z.string(),
      last_name: z.string(),
      email: z.string(),
      role: orgRole,
      temp_password: z.string().describe("Temporary password the invitee will use for their first login."),
      workspace_id: z.string().optional(),
    }),
  }),
  change_org_user_role: tool({
    description: "Change an org user's role. Only usable by someone above the target's current and new role.",
    inputSchema: z.object({
      userId: z.string(),
      role: orgRole,
    }),
  }),
  list_workspace_members: tool({
    description: "List members of a workspace.",
    inputSchema: z.object({ workspaceId: z.string() }),
  }),
  add_workspace_member: tool({
    description: "Add an existing organisation user to a workspace directly (no email invite needed).",
    inputSchema: z.object({ workspaceId: z.string(), userId: z.string() }),
  }),
  remove_workspace_member: tool({
    description: "Remove a user from a workspace.",
    inputSchema: z.object({ workspaceId: z.string(), userId: z.string() }),
  }),
  change_workspace_member_role: tool({
    description: "Change a workspace member's org-wide role. Requires SUPER_ADMIN.",
    inputSchema: z.object({
      workspaceId: z.string(),
      userId: z.string(),
      role: workspaceRole,
    }),
  }),

  // ── Navigation ────────────────────────────────────────────────
  navigate: tool({
    description: "Navigate the user to a page in the app.",
    inputSchema: z.object({
      path: z.string().describe(
      "App path. Valid patterns: /dashboard, /workspaces/45 (a specific workspace), /projects/123 (a specific project), /tasks/9 (a specific task), /team, /notifications, /settings. Always use a real numeric id from a prior tool call — never invent one."
    ),
    }),
  }),
};

type ChatRequestBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.GROQ_API_KEY;
        if (!key) {
          return new Response("Missing GROQ_API_KEY", { status: 500 });
        }

        const groq = createOpenAICompatible({
          name: "groq",
          baseURL: "https://api.groq.com/openai/v1",
          apiKey: key,
        });

        // Strip reasoning parts before re-sending history — Groq rejects
        // "reasoning_content" on inbound assistant messages.
        const sanitized = (messages as UIMessage[]).map((m) => ({
          ...m,
          parts: m.parts.filter((p) => p.type !== "reasoning"),
        }));

        const result = streamText({
          model: groq("openai/gpt-oss-120b"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(sanitized),
          tools,
          stopWhen: stepCountIs(10),
          onError: (err) => console.error("streamText error:", err),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
