import type {
  ActionResponse,
  AuditLogResponse,
  CategoryResponse,
  CategoryRolePermissionResponse,
  CategoryRolePermissionUpsertItem,
  CategoryTreeNodeResponse,
  CategoryKnowledgeBulkMoveRequest,
  CategoryKnowledgeBulkMoveResponse,
  CategoryPolicyResponse,
  CategoryPolicySimulateResponse,
  CategoryPolicyUpsertRequest,
  CategoryAutomationResponse,
  AutoCategorizeSourceResponse,
  CategoryHeatmapPointResponse,
  EmployeeProfileResponse,
  KnowledgeSourceResponse,
  KnowledgeSyncSummaryResponse,
  KnowledgeGapResponse,
  KnowledgeChunkResponse,
  QaSandboxResponse,
  GovernanceOverviewResponse,
  PolicyRuleResponse,
  PolicyRuleRevisionResponse,
  PolicyViolationResponse,
  PlaybookResponse,
  SkillConfigResponse,
  SkillConfigSimulateResponse,
  SkillUsageTimeseriesResponse,
  SkillRunResponse,
  SkillTemplateAuditEventResponse,
  SkillTemplateResponse,
  TenantHealthResponse,
  TenantResponse,
  TokenResponse,
  UserResponse,
  WidgetAdminConfigResponse,
  WidgetAdminConfigUpdateRequest,
  WidgetBehaviorAccessResponse,
  CategoryManagementAccessResponse,
  WidgetRotateTokenResponse,
} from "./adminTypes";

const API_BASE = typeof window !== "undefined" ? "/api" : (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/api` : "http://127.0.0.1:8000/api");

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

async function adminRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${cleanPath}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────

export async function superadminLogin(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/superadmin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email || "superadmin@platform.com", password: password || "SuperAdmin123!" }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Superadmin login failed (${res.status}): ${errText}`);
  }
  const data: TokenResponse = await res.json();
  localStorage.setItem("admin_token", data.access_token);
  localStorage.setItem("admin_user", JSON.stringify(data.user));
  return data;
}

export async function companyLogin(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/company/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email || "admin@techcorp.com", password: password || "TechAdmin123!" }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Company login failed (${res.status}): ${errText}`);
  }
  const data: TokenResponse = await res.json();
  localStorage.setItem("admin_token", data.access_token);
  localStorage.setItem("admin_user", JSON.stringify(data.user));
  return data;
}

export function getStoredUser(): UserResponse | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("admin_user");
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
}

export async function getMe(): Promise<UserResponse> {
  const user = getStoredUser();
  const prefix = user?.role === "superadmin" ? "/superadmin" : "/company";
  return adminRequest<UserResponse>(`${prefix}/auth/me`);
}

// ── Superadmin: Tenants ──────────────────────────────────────────────────

export async function listTenants(): Promise<TenantResponse[]> {
  return adminRequest<TenantResponse[]>("/superadmin/tenants");
}

export async function createTenant(data: {
  name: string;
  slug: string;
  logo_url?: string;
}): Promise<TenantResponse> {
  return adminRequest<TenantResponse>("/superadmin/tenants", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTenant(
  id: string,
  data: Partial<{
    name: string;
    logo_url: string;
    status: string;
    settings: Record<string, unknown>;
  }>,
): Promise<TenantResponse> {
  return adminRequest<TenantResponse>(`/superadmin/tenants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ── Superadmin: Users ────────────────────────────────────────────────────

export async function listUsers(tenantId?: string): Promise<UserResponse[]> {
  const q = tenantId ? `?tenant_id=${tenantId}` : "";
  return adminRequest<UserResponse[]>(`/superadmin/users${q}`);
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: string;
  tenant_id?: string;
}): Promise<UserResponse> {
  return adminRequest<UserResponse>("/superadmin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Superadmin: Skill Templates ──────────────────────────────────────────

export async function listSkillTemplates(): Promise<SkillTemplateResponse[]> {
  return adminRequest<SkillTemplateResponse[]>("/superadmin/skill-templates");
}

export async function createSkillTemplate(data: {
  name: string;
  skill_type: string;
  description?: string;
  default_config?: Record<string, unknown>;
}): Promise<SkillTemplateResponse> {
  return adminRequest<SkillTemplateResponse>("/superadmin/skill-templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSkillTemplate(
  templateId: string,
  data: Partial<{
    description: string;
    default_config: Record<string, unknown>;
    is_active: boolean;
  }>,
): Promise<SkillTemplateResponse> {
  return adminRequest<SkillTemplateResponse>(
    `/superadmin/skill-templates/${templateId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

export async function listSkillTemplateHistory(
  templateId: string,
  limit = 50,
): Promise<SkillTemplateAuditEventResponse[]> {
  return adminRequest<SkillTemplateAuditEventResponse[]>(
    `/superadmin/skill-templates/${templateId}/history?limit=${limit}`,
  );
}

export async function exportSkillTemplateHistory(
  templateId: string,
  options: {
    format: "json" | "csv";
    limit?: number;
    action?: "all" | "create" | "update" | "upsert" | "delete";
    window_days?: number;
    only_changed_fields?: boolean;
  },
): Promise<{
  blob: Blob;
  filename: string;
  sha256: string | null;
  signature: string | null;
}> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const params = new URLSearchParams();
  params.set("format", options.format);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.action) params.set("action", options.action);
  if (options.window_days !== undefined) {
    params.set("window_days", String(options.window_days));
  }
  if (options.only_changed_fields !== undefined) {
    params.set("only_changed_fields", String(options.only_changed_fields));
  }
  const res = await fetch(
    `${API_BASE}/superadmin/skill-templates/${templateId}/history/export?${params.toString()}`,
    { headers },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  const blob = await res.blob();
  const contentDisposition = res.headers.get("Content-Disposition") ?? "";
  const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
  return {
    blob,
    filename: filenameMatch?.[1] ?? `skill-template-history.${options.format}`,
    sha256: res.headers.get("X-Audit-SHA256"),
    signature: res.headers.get("X-Audit-Signature"),
  };
}

// ── Superadmin: Policies ─────────────────────────────────────────────────

export async function listGlobalPolicies(): Promise<PolicyRuleResponse[]> {
  return adminRequest<PolicyRuleResponse[]>("/superadmin/policies");
}

export async function createGlobalPolicy(data: {
  name: string;
  rule_type: string;
  config?: Record<string, unknown>;
  is_required?: boolean;
}): Promise<PolicyRuleResponse> {
  return adminRequest<PolicyRuleResponse>("/superadmin/policies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateGlobalPolicy(
  policyId: string,
  data: Partial<{
    name: string;
    config: Record<string, unknown>;
    is_active: boolean;
    is_required: boolean;
  }>,
): Promise<PolicyRuleResponse> {
  return adminRequest<PolicyRuleResponse>(`/superadmin/policies/${policyId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getGovernanceOverview(): Promise<GovernanceOverviewResponse> {
  return adminRequest<GovernanceOverviewResponse>(
    "/superadmin/policies/governance-overview",
  );
}

export async function listPolicyViolations(
  limit = 100,
): Promise<PolicyViolationResponse[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  return adminRequest<PolicyViolationResponse[]>(
    `/superadmin/policies/violations?${q.toString()}`,
  );
}

export async function listPolicyRevisions(
  policyId: string,
): Promise<PolicyRuleRevisionResponse[]> {
  return adminRequest<PolicyRuleRevisionResponse[]>(
    `/superadmin/policies/${policyId}/revisions`,
  );
}

export async function downloadComplianceReportPdf(
  tenantId: string,
): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `${API_BASE}/superadmin/policies/compliance-report?tenant_id=${encodeURIComponent(tenantId)}`,
    { headers },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.blob();
}

// ── Superadmin: Default Categories / Actions ─────────────────────────────

export async function listDefaultCategories(): Promise<CategoryResponse[]> {
  return adminRequest<CategoryResponse[]>("/superadmin/default-categories");
}

export async function updateDefaultCategory(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    icon: string;
    parent_id: string;
    sort_order: number;
    is_active: boolean;
  }>,
): Promise<CategoryResponse> {
  return adminRequest<CategoryResponse>(`/superadmin/default-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteDefaultCategory(id: string): Promise<void> {
  return adminRequest<void>(`/superadmin/default-categories/${id}`, {
    method: "DELETE",
  });
}

export async function listDefaultActions(): Promise<ActionResponse[]> {
  return adminRequest<ActionResponse[]>("/superadmin/default-actions");
}

export async function updateDefaultAction(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    prompt_template: string;
    icon: string;
    category_id: string;
    is_pinned: boolean;
    is_active: boolean;
    status: string;
  }>,
): Promise<ActionResponse> {
  return adminRequest<ActionResponse>(`/superadmin/default-actions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteDefaultAction(id: string): Promise<void> {
  return adminRequest<void>(`/superadmin/default-actions/${id}`, {
    method: "DELETE",
  });
}

// ── Superadmin: Dashboard ────────────────────────────────────────────────

export async function getTenantHealth(): Promise<TenantHealthResponse[]> {
  return adminRequest<TenantHealthResponse[]>(
    "/superadmin/dashboard/tenant-health",
  );
}

export async function listAuditLogs(
  tenantId?: string,
  page = 1,
): Promise<AuditLogResponse[]> {
  const params = new URLSearchParams({ page: String(page) });
  if (tenantId) params.set("tenant_id", tenantId);
  return adminRequest<AuditLogResponse[]>(
    `/superadmin/audit-logs?${params.toString()}`,
  );
}

// ── Company Admin: Categories ────────────────────────────────────────────

export async function listCategories(): Promise<CategoryResponse[]> {
  return adminRequest<CategoryResponse[]>("/company/categories");
}

export async function listCategoryTree(): Promise<CategoryTreeNodeResponse[]> {
  return adminRequest<CategoryTreeNodeResponse[]>("/company/categories/tree");
}

export async function getCategoryVisibilityMatrix(
  categoryId: string,
): Promise<CategoryRolePermissionResponse[]> {
  return adminRequest<CategoryRolePermissionResponse[]>(
    `/company/categories/${categoryId}/visibility`,
  );
}

export async function upsertCategoryVisibilityMatrix(
  categoryId: string,
  rows: CategoryRolePermissionUpsertItem[],
): Promise<CategoryRolePermissionResponse[]> {
  return adminRequest<CategoryRolePermissionResponse[]>(
    `/company/categories/${categoryId}/visibility`,
    {
      method: "PUT",
      body: JSON.stringify(rows),
    },
  );
}

export async function listCategoryKnowledgeSources(
  categoryId: string,
): Promise<KnowledgeSourceResponse[]> {
  return adminRequest<KnowledgeSourceResponse[]>(
    `/company/categories/${categoryId}/knowledge-sources`,
  );
}

export async function bulkMoveKnowledgeSourcesBetweenCategories(
  payload: CategoryKnowledgeBulkMoveRequest,
): Promise<CategoryKnowledgeBulkMoveResponse> {
  return adminRequest<CategoryKnowledgeBulkMoveResponse>(
    "/company/categories/knowledge-sources/bulk-move",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getCategoryPolicy(
  categoryId: string,
): Promise<CategoryPolicyResponse | null> {
  return adminRequest<CategoryPolicyResponse | null>(
    `/company/categories/${categoryId}/policy`,
  );
}

export async function upsertCategoryPolicy(
  categoryId: string,
  payload: CategoryPolicyUpsertRequest,
): Promise<CategoryPolicyResponse> {
  return adminRequest<CategoryPolicyResponse>(
    `/company/categories/${categoryId}/policy`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function simulateCategoryPolicy(
  categoryId: string,
  payload: { prompt: string; top_k_override?: number },
): Promise<CategoryPolicySimulateResponse> {
  return adminRequest<CategoryPolicySimulateResponse>(
    `/company/categories/${categoryId}/policy/simulate`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function upsertCategoryAutomation(
  categoryId: string,
  payload: {
    auto_categorization_enabled: boolean;
    keywords: string[];
    confidence_threshold: number;
  },
): Promise<CategoryAutomationResponse> {
  return adminRequest<CategoryAutomationResponse>(
    `/company/categories/${categoryId}/automation`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function runAutoCategorization(
  sourceId: string,
): Promise<AutoCategorizeSourceResponse> {
  return adminRequest<AutoCategorizeSourceResponse>(
    `/company/knowledge/${sourceId}/auto-categorize`,
    {
      method: "POST",
    },
  );
}

export async function getCategoryUsageHeatmap(
  windowDays = 30,
): Promise<CategoryHeatmapPointResponse[]> {
  return adminRequest<CategoryHeatmapPointResponse[]>(
    `/company/categories/analytics/heatmap?window_days=${windowDays}`,
  );
}

export async function createCategory(data: {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent_id?: string;
}): Promise<CategoryResponse> {
  return adminRequest<CategoryResponse>("/company/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    icon: string;
    sort_order: number;
    is_active: boolean;
  }>,
): Promise<CategoryResponse> {
  return adminRequest<CategoryResponse>(`/company/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ── Company Admin: Actions ───────────────────────────────────────────────

export async function listActions(
  categoryId?: string,
): Promise<ActionResponse[]> {
  const q = categoryId ? `?category_id=${categoryId}` : "";
  return adminRequest<ActionResponse[]>(`/company/actions${q}`);
}

export async function createAction(data: {
  title: string;
  description?: string;
  prompt_template?: string;
  icon?: string;
  category_id?: string;
  playbook_id?: string;
  input_schema_json?: Record<string, unknown>;
  is_pinned?: boolean;
}): Promise<ActionResponse> {
  return adminRequest<ActionResponse>("/company/actions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAction(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    prompt_template: string;
    icon: string;
    category_id: string;
    playbook_id: string | null;
    input_schema_json: Record<string, unknown> | null;
    is_pinned: boolean;
    is_active: boolean;
    status: string;
  }>,
): Promise<ActionResponse> {
  return adminRequest<ActionResponse>(`/company/actions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAction(id: string): Promise<void> {
  return adminRequest<void>(`/company/actions/${id}`, { method: "DELETE" });
}

export async function getStarterActions(): Promise<{
  actions: ActionResponse[];
}> {
  return adminRequest<{ actions: ActionResponse[] }>(
    "/company/starter-actions",
  );
}

export async function listPlaybooks(): Promise<PlaybookResponse[]> {
  return adminRequest<PlaybookResponse[]>("/company/playbooks");
}

export async function createPlaybook(data: {
  name: string;
  slug: string;
  config_json: Record<string, unknown>;
  is_default?: boolean;
}): Promise<PlaybookResponse> {
  return adminRequest<PlaybookResponse>("/company/playbooks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function publishPlaybook(playbookId: string): Promise<{
  playbook: PlaybookResponse;
  validation_errors: string[];
}> {
  return adminRequest<{ playbook: PlaybookResponse; validation_errors: string[] }>(
    `/company/playbooks/${playbookId}/publish`,
    { method: "POST" },
  );
}

export async function updatePlaybook(
  playbookId: string,
  data: Partial<{
    name: string;
    config_json: Record<string, unknown>;
    is_default: boolean;
  }>,
): Promise<PlaybookResponse> {
  return adminRequest<PlaybookResponse>(`/company/playbooks/${playbookId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function bindActionPlaybook(
  actionId: string,
  playbookId: string | null,
): Promise<ActionResponse> {
  return adminRequest<ActionResponse>(`/company/actions/${actionId}/bind-playbook`, {
    method: "POST",
    body: JSON.stringify({ playbook_id: playbookId }),
  });
}

// ── Company Admin: Knowledge Base ────────────────────────────────────────

export async function listKnowledgeSources(): Promise<
  KnowledgeSourceResponse[]
> {
  return adminRequest<KnowledgeSourceResponse[]>("/company/knowledge");
}

export async function createKnowledgeSource(data: {
  title: string;
  source_type: string;
  connector_kind?: string;
  sync_frequency?: string;
  source_url?: string;
  raw_content?: string;
}): Promise<KnowledgeSourceResponse> {
  return adminRequest<KnowledgeSourceResponse>("/company/knowledge", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteKnowledgeSource(id: string): Promise<void> {
  return adminRequest<void>(`/company/knowledge/${id}`, { method: "DELETE" });
}

export async function retryKnowledgeSource(id: string): Promise<KnowledgeSourceResponse> {
  return adminRequest<KnowledgeSourceResponse>(`/company/knowledge/${id}/retry`, {
    method: "POST",
  });
}

export async function getKnowledgeSyncSummary(): Promise<KnowledgeSyncSummaryResponse> {
  return adminRequest<KnowledgeSyncSummaryResponse>("/company/knowledge/sync/summary");
}

export async function listKnowledgeGaps(): Promise<KnowledgeGapResponse[]> {
  return adminRequest<KnowledgeGapResponse[]>("/company/knowledge-gaps");
}

export async function listKnowledgeChunks(sourceId: string): Promise<KnowledgeChunkResponse[]> {
  return adminRequest<KnowledgeChunkResponse[]>(`/company/knowledge/${sourceId}/chunks`);
}

export async function runKnowledgeQaSandbox(data: {
  prompt: string;
  top_k?: number;
  source_ids?: string[];
}): Promise<QaSandboxResponse> {
  return adminRequest<QaSandboxResponse>("/company/knowledge/qa-sandbox", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function markKnowledgeGap(data: {
  prompt: string;
  skill_run_id?: string | null;
  source_ids?: string[];
}): Promise<{ ok: boolean }> {
  return adminRequest<{ ok: boolean }>("/company/knowledge/qa-sandbox/mark-gap", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Company Admin: Employees ─────────────────────────────────────────────

export async function listEmployees(): Promise<EmployeeProfileResponse[]> {
  return adminRequest<EmployeeProfileResponse[]>("/company/employees");
}

export async function createEmployee(data: {
  name: string;
  email?: string;
  title?: string;
  department?: string;
  bio?: string;
  github_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  resume_url?: string;
  current_location?: string;
  availability_status?: string;
  years_of_experience?: number;
  candidate_notes?: string;
  is_internal_candidate?: boolean;
  talent_pool?: string;
  expertise?: string[];
  lifecycle_status?: "Active Employee" | "Internal Candidate" | "Inactive";
  send_invite_email?: boolean;
}): Promise<EmployeeProfileResponse> {
  return adminRequest<EmployeeProfileResponse>("/company/employees", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEmployee(
  id: string,
  data: Partial<{
    name: string;
    email: string;
    title: string;
    department: string;
    bio: string;
    github_url: string;
    linkedin_url: string;
    portfolio_url: string;
    resume_url: string;
    current_location: string;
    availability_status: string;
    years_of_experience: number;
    candidate_notes: string;
    is_internal_candidate: boolean;
    talent_pool: string;
    expertise: string[];
    lifecycle_status: "Active Employee" | "Internal Candidate" | "Inactive";
    send_invite_email: boolean;
    is_active: boolean;
  }>,
): Promise<EmployeeProfileResponse> {
  return adminRequest<EmployeeProfileResponse>(`/company/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function bulkImportEmployees(
  employees: Array<{
    name: string;
    email?: string;
    title?: string;
    department?: string;
    github_url?: string;
    linkedin_url?: string;
    portfolio_url?: string;
    resume_url?: string;
    current_location?: string;
    availability_status?: string;
    years_of_experience?: number;
    candidate_notes?: string;
    is_internal_candidate?: boolean;
    talent_pool?: string;
    expertise?: string[];
    lifecycle_status?: "Active Employee" | "Internal Candidate" | "Inactive";
    send_invite_email?: boolean;
  }>,
): Promise<EmployeeProfileResponse[]> {
  return adminRequest<EmployeeProfileResponse[]>(
    "/company/employees/bulk-import",
    {
      method: "POST",
      body: JSON.stringify({ employees }),
    },
  );
}

// ── Company Admin: Skill Configs ─────────────────────────────────────────

export async function listSkillConfigs(): Promise<SkillConfigResponse[]> {
  return adminRequest<SkillConfigResponse[]>("/company/skill-configs");
}

export async function upsertSkillConfig(data: {
  template_id: string;
  config_overrides?: Record<string, unknown>;
  is_enabled?: boolean;
}): Promise<SkillConfigResponse> {
  return adminRequest<SkillConfigResponse>("/company/skill-configs", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function simulateSkillConfig(
  templateId: string,
  data: { prompt: string; config_overrides?: Record<string, unknown> },
): Promise<SkillConfigSimulateResponse> {
  return adminRequest<SkillConfigSimulateResponse>(
    `/company/skill-configs/${templateId}/simulate`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function getSkillUsageTimeseries(
  windowDays = 7,
): Promise<SkillUsageTimeseriesResponse[]> {
  return adminRequest<SkillUsageTimeseriesResponse[]>(
    `/company/skill-configs/analytics/timeseries?window_days=${windowDays}`,
  );
}

// ── Widget Admin: Company ─────────────────────────────────────────────────

export async function getCompanyWidgetAdminConfig(): Promise<WidgetAdminConfigResponse> {
  return adminRequest<WidgetAdminConfigResponse>("/company/widget-admin/config");
}

export async function getCompanyWidgetBehaviorAccess(): Promise<WidgetBehaviorAccessResponse> {
  return adminRequest<WidgetBehaviorAccessResponse>("/company/widget-admin/access");
}

export async function getCompanyCategoryManagementAccess(): Promise<CategoryManagementAccessResponse> {
  return adminRequest<CategoryManagementAccessResponse>("/company/categories/access");
}

export async function updateCompanyWidgetAdminConfig(
  payload: WidgetAdminConfigUpdateRequest,
): Promise<WidgetAdminConfigResponse> {
  return adminRequest<WidgetAdminConfigResponse>("/company/widget-admin/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function rotateCompanyWidgetEmbedToken(): Promise<WidgetRotateTokenResponse> {
  return adminRequest<WidgetRotateTokenResponse>("/company/widget-admin/rotate-token", {
    method: "POST",
  });
}

// ── Widget Admin: Superadmin ──────────────────────────────────────────────

export async function getSuperadminWidgetAdminConfig(): Promise<WidgetAdminConfigResponse> {
  return adminRequest<WidgetAdminConfigResponse>("/superadmin/widget-admin/config");
}

export async function updateSuperadminWidgetAdminConfig(
  payload: WidgetAdminConfigUpdateRequest,
): Promise<WidgetAdminConfigResponse> {
  return adminRequest<WidgetAdminConfigResponse>("/superadmin/widget-admin/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function rotateSuperadminWidgetEmbedToken(): Promise<WidgetRotateTokenResponse> {
  return adminRequest<WidgetRotateTokenResponse>("/superadmin/widget-admin/rotate-token", {
    method: "POST",
  });
}

// ── Company Admin: Audit & Runs ──────────────────────────────────────────

export async function listTenantAuditLogs(
  page = 1,
): Promise<AuditLogResponse[]> {
  return adminRequest<AuditLogResponse[]>(
    `/company/audit-logs?page=${page}`,
  );
}

export async function listSkillRuns(page = 1): Promise<SkillRunResponse[]> {
  return adminRequest<SkillRunResponse[]>(
    `/company/skill-runs?page=${page}`,
  );
}

// ── Shared Practice Results for Candidate Detail View ──────────────────────

export interface SharedPracticeResult {
  id: string;
  candidate_id: string;
  job_id: string | null;
  job_title: string;
  niche: string;
  overall_score: number;
  strong_areas: string[];
  weak_areas: string[];
  suggestions: string[];
  shared_at: string | null;
  created_at: string;
}

export async function getSharedPracticeResults(
  candidateId: string,
): Promise<SharedPracticeResult[]> {
  return adminRequest<SharedPracticeResult[]>(
    `/company/candidates/${candidateId}/practice-results`,
  );
}

