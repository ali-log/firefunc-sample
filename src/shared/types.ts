// Core domain types for the task/project-tracker SaaS.
// These are the fixed contracts module agents implement against.

export type ID = string;
export type ISODateString = string;

export type TaskState = "todo" | "in_progress" | "blocked" | "done";

export type Priority = "low" | "medium" | "high" | "urgent";

export type UserRole = "owner" | "admin" | "member" | "viewer";

export type ProjectStatus = "active" | "archived";

export type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly";

export type SlaStatus = "on_track" | "at_risk" | "breached" | "none";

export interface User {
  id: ID;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Project {
  id: ID;
  key: string; // short uppercase key, e.g. "FIRE"
  name: string;
  description: string | null;
  status: ProjectStatus;
  ownerId: ID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number; // every N units
  count: number | null; // optional total occurrences
  until: ISODateString | null;
}

export interface Task {
  id: ID;
  projectId: ID;
  parentId: ID | null;
  title: string;
  description: string | null;
  state: TaskState;
  priority: Priority;
  assigneeId: ID | null;
  reporterId: ID;
  labels: string[];
  estimateHours: number | null;
  dueAt: ISODateString | null;
  slaMinutes: number | null; // SLA window in minutes from creation
  recurrence: RecurrenceRule | null;
  position: number; // ordering within a board column
  createdAt: ISODateString;
  updatedAt: ISODateString;
  completedAt: ISODateString | null;
}

export interface TaskComment {
  id: ID;
  taskId: ID;
  authorId: ID;
  body: string;
  createdAt: ISODateString;
}

export interface TaskEvent {
  id: ID;
  taskId: ID;
  actorId: ID;
  type: "created" | "state_changed" | "assigned" | "commented" | "updated";
  fromState: TaskState | null;
  toState: TaskState | null;
  payload: Record<string, unknown> | null;
  createdAt: ISODateString;
}

// ---- DTOs for create/update operations ----

export interface CreateTaskInput {
  projectId: ID;
  title: string;
  description?: string | null;
  priority?: Priority;
  assigneeId?: ID | null;
  reporterId: ID;
  labels?: string[];
  estimateHours?: number | null;
  dueAt?: ISODateString | null;
  slaMinutes?: number | null;
  recurrence?: RecurrenceRule | null;
  parentId?: ID | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  state?: TaskState;
  priority?: Priority;
  assigneeId?: ID | null;
  labels?: string[];
  estimateHours?: number | null;
  dueAt?: ISODateString | null;
  slaMinutes?: number | null;
  recurrence?: RecurrenceRule | null;
  position?: number;
}

export interface CreateProjectInput {
  key: string;
  name: string;
  description?: string | null;
  ownerId: ID;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role?: UserRole;
  avatarUrl?: string | null;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  avatarUrl?: string | null;
}

// ---- Query / filtering ----

export interface TaskQuery {
  projectId?: ID;
  state?: TaskState | TaskState[];
  priority?: Priority | Priority[];
  assigneeId?: ID | null;
  labels?: string[];
  search?: string;
  dueBefore?: ISODateString;
  dueAfter?: ISODateString;
  sort?: TaskSortField;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export type TaskSortField =
  | "priority"
  | "dueAt"
  | "createdAt"
  | "updatedAt"
  | "position"
  | "title";

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---- Reporting ----

export interface ProjectReport {
  projectId: ID;
  totalTasks: number;
  byState: Record<TaskState, number>;
  byPriority: Record<Priority, number>;
  overdue: number;
  slaBreached: number;
  completedThisWeek: number;
  avgCycleTimeHours: number | null;
}

export interface BurndownPoint {
  date: ISODateString;
  remaining: number;
  completed: number;
}

// ---- Auth ----

export interface AuthContext {
  userId: ID;
  role: UserRole;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}
