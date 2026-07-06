Testing order:

Register → get token
Login → get token
Create workspace
Invite user to org
Add user to workspace members
Create project
Assign member to project
Create task
Add comment
Check notifications and activity


data flow:

User registers in the system.
System creates a new organization automatically.
The first registered user becomes Super Admin.
Super Admin becomes the owner of that organization.
User logs in with email and password.
System generates:
Access token
Refresh token
Super Admin can invite:
Admin
Sub Admin
Member
Role hierarchy:
Super Admin
Admin
Sub Admin
Member
Users can create only lower-level roles than themselves.
Invitation process:
User enters details
System creates invitation token
Temporary password is generated
Email invitation is sent
Invited user clicks activation link.
System validates:
Token exists
Token is not expired
User account is created inside the same organization.
User logs in using temporary password.
System forces user to change password on first login.
Super Admin, Admin, and Sub Admin can create workspaces.
Workspace is linked to an organization.
Users are added as workspace members.
Inside a workspace users can create projects.
Members can be assigned to projects.
Tasks can be created inside projects.
Task contains:
Title
Description
Priority
Assigned user
Status
Members can only update task status:
TODO
IN_PROGRESS
DONE
Members cannot:
Create workspace
Create project
Create task
Delete users
Users can add comments to tasks.
Notifications are generated for:
User invitation
Project assignment
Task assignment
Comments
Status updates
Activity logs track:
Workspace creation
User invitation
Project creation
Task creation
Task updates
User deletion
Permission structure:
Super Admin → full access
Admin → manage Sub Admin and Members
Sub Admin → manage Members only
Member → task work only
Complete workflow:

Register → Organization created → Super Admin created → Login → Invite users → User accepts invitation → Password change → Workspace creation → Project creation → Assign members → Create tasks → Update tasks → Comments → Notifications → Activity logs.

