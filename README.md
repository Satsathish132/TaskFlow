# Taskflow

A professional collaborative project management app built with React + Vite.

## Project Structure

```
src/
├── lib/
│   ├── api.js          # API client (fetch wrapper + auth headers)
│   └── theme.js        # Design tokens — colors, radius, shadows, badge maps
│
├── hooks/
│   └── useToast.js     # Toast notification hook
│
├── components/
│   └── ui/
│       └── index.jsx   # All shared UI primitives:
│                         Icon, Toast, Modal, Input, Textarea,
│                         Select, Btn, Badge, Avatar, Card,
│                         PageHeader, EmptyState, BreadcrumbBtn
│
├── layouts/
│   └── Sidebar.jsx     # App sidebar with nav, workspace info, user panel
│
├── pages/
│   ├── AuthPage.jsx         # Sign in / Sign up
│   ├── WorkspacesPage.jsx   # Workspace grid + create modal
│   ├── ProjectsPage.jsx     # Project grid + create modal
│   ├── TasksPage.jsx        # Kanban board + task CRUD + comments
│   ├── MembersPage.jsx      # Member list + invite + role management
│   ├── NotificationsPage.jsx# Notifications + mark read
│   └── ActivityPage.jsx     # Timeline activity log
│
└── App.jsx             # Root — routing, shared state, layout shell
```

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (proxies /api → http://localhost:5000)
npm run dev

# Build for production
npm run build
```

## Backend

The app expects a REST API at `http://localhost:5000/api` with these routes:

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Sign in, returns `accessToken` + `refreshToken` |
| POST | /auth/signup | Create account |
| GET | /workspaces/my | List user's workspaces |
| POST | /workspaces/create | Create workspace |
| GET | /projects/:workspaceId | List projects |
| POST | /projects/create | Create project |
| GET | /tasks/:workspaceId | List tasks |
| POST | /tasks/create | Create task |
| PUT | /tasks/status | Update task status |
| PUT | /tasks/:id | Edit task |
| DELETE | /tasks/:id | Delete task |
| GET | /comments/:taskId | List comments |
| POST | /comments/add | Add comment |
| GET | /members/:workspaceId | List members |
| POST | /members/invite | Invite member by email |
| PUT | /members/role | Change member role |
| GET | /notifications/ | List notifications |
| PUT | /notifications/:id/read | Mark notification read |
| GET | /activity/:workspaceId | Workspace activity log |

## Design System

All colors and design tokens live in `src/lib/theme.js`. To change the brand color, update `colors.indigo` there — everything cascades automatically.

