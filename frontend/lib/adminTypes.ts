export type UserRole = "superadmin" | "admin" | "editor" | "viewer";
export type ContentStatus = "draft" | "published" | "archived";
export type PlaybookStatus = "draft" | "published" | "archived";
export type EmployeeLifecycleStatus =
  | "Active Employee"
  | "Internal Candidate"
  | "Inactive";

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenant_id: string | null;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  settings: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export interface WidgetBehaviorAccessResponse {
  can_edit_behavior: boolean;
}

export interface CategoryManagementAccessResponse {
  can_manage_categories: boolean;
}

export interface WidgetAdminConfigResponse {
  bot_id: string;
  name: string;
  welcome_text: string;
  primary_color: string;
  launcher_position: string;
  allowed_domains: string[];
  active_token_last4?: string | null;
}

export interface WidgetAdminConfigUpdateRequest {
  name?: string;
  welcome_text?: string;
  primary_color?: string;
  launcher_position?: string;
  allowed_domains?: string[];
}

export interface WidgetRotateTokenResponse {
  embed_token: string;
  last4: string;
}

export interface CategoryResponse {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parent_id: string | null;
  path: string;
  depth: number;
  color_token: string | null;
  icon_key: string | null;
  department: string | null;
  last_synced_at: string | null;
  auto_categorization_enabled: boolean;
  auto_categorization_keywords?: string[] | null;
  auto_categorization_threshold?: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CategoryTreeNodeResponse {
  id: string;
  tenant_id: string | null;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  icon_key: string | null;
  color_token: string | null;
  department: string | null;
  path: string;
  depth: number;
  sort_order: number;
  is_active: boolean;
  linked_knowledge_documents: number;
  active_user_permissions: number;
  last_synced_at: string | null;
  children: CategoryTreeNodeResponse[];
  auto_categorization_enabled: boolean;
  auto_categorization_keywords: string[];
  auto_categorization_threshold: number;
}

export interface CategoryRolePermissionResponse {
  id: string;
  tenant_id: string;
  category_id: string;
  role: string;
  permission_level: "none" | "view" | "edit" | "publish";
  inherits_to_children: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryRolePermissionUpsertItem {
  role: string;
  permission_level: "none" | "view" | "edit" | "publish";
  inherits_to_children: boolean;
}

export interface CategoryKnowledgeBulkMoveRequest {
  source_ids: string[];
  from_category_id?: string;
  to_category_id: string;
  mode: "move" | "copy";
  dry_run: boolean;
}

export interface CategoryKnowledgeBulkMoveResponse {
  mode: "move" | "copy";
  dry_run: boolean;
  total_requested: number;
  total_matched: number;
  moved: number;
  copied: number;
  skipped_existing: number;
}

export interface CategoryPolicyResponse {
  id: string;
  tenant_id: string;
  category_id: string;
  version: number;
  system_instructions: string;
  retrieval_top_k: number;
  min_score: number | null;
  source_priority: Record<string, unknown> | null;
  citation_required: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryPolicyUpsertRequest {
  system_instructions: string;
  retrieval_top_k: number;
  min_score?: number | null;
  source_priority?: Record<string, unknown> | null;
  citation_required: boolean;
  is_active: boolean;
}

export interface CategoryPolicySimulateResponse {
  skill_run_id: string | null;
  answer: string;
  confidence: number;
  applied_policy_version: number;
  applied_top_k: number;
  citations: QaSandboxCitation[];
}

export interface CategoryAutomationResponse {
  category_id: string;
  auto_categorization_enabled: boolean;
  keywords: string[];
  confidence_threshold: number;
}

export interface AutoCategorizeSourceResponse {
  source_id: string;
  matched_category_ids: string[];
  linked_count: number;
}

export interface CategoryHeatmapPointResponse {
  category_id: string;
  category_name: string;
  query_count: number;
  low_confidence_count: number;
  avg_confidence: number;
}

export interface ActionResponse {
  id: string;
  tenant_id: string | null;
  category_id: string | null;
  playbook_id: string | null;
  title: string;
  description: string | null;
  prompt_template: string | null;
  input_schema_json: Record<string, unknown> | null;
  icon: string | null;
  sort_order: number;
  is_pinned: boolean;
  is_active: boolean;
  click_count: number;
  status: ContentStatus;
  created_at: string;
}

export interface PlaybookResponse {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  version: number;
  status: PlaybookStatus;
  config_json: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSourceResponse {
  id: string;
  tenant_id: string;
  title: string;
  source_type: string;
  connector_kind: string | null;
  sync_frequency: string;
  source_url: string | null;
  status: string;
  chunk_count: number;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSyncSummaryResponse {
  total_sources: number;
  indexed_sources: number;
  syncing_sources: number;
  failed_sources: number;
  total_chunks: number;
  embedded_chunks: number;
  embedding_coverage_pct: number;
  avg_chunks_per_source: number;
}

export interface KnowledgeGapResponse {
  label: string;
  query_count: number;
  failed_runs: number;
  avg_confidence: number;
  last_seen_at: string | null;
}

export interface KnowledgeChunkResponse {
  id: string;
  content: string;
  chunk_index: number;
  chunk_metadata: Record<string, unknown> | null;
}

export interface QaSandboxCitation {
  chunk_id: string;
  score: number;
  content: string;
}

export interface QaSandboxResponse {
  skill_run_id: string | null;
  answer: string;
  confidence: number;
  citations: QaSandboxCitation[];
}

export interface EmployeeProfileResponse {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  title: string | null;
  department: string | null;
  bio: string | null;
  avatar_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  resume_url: string | null;
  current_location: string | null;
  availability_status: string | null;
  years_of_experience: number | null;
  candidate_notes: string | null;
  is_internal_candidate: boolean;
  talent_pool: string | null;
  expertise: string[];
  lifecycle_status: EmployeeLifecycleStatus;
  invite_email_sent_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SkillTemplateResponse {
  id: string;
  name: string;
  description: string | null;
  skill_type: string;
  default_config: Record<string, unknown> | null;
  is_active: boolean;
  version: number;
  created_at: string;
  last_updated_at?: string | null;
  last_updated_by?: string | null;
}

export interface SkillTemplateAuditEventResponse {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
}

export interface SkillConfigResponse {
  id: string;
  tenant_id: string;
  template_id: string;
  template_name: string | null;
  template_description?: string | null;
  skill_type?: string | null;
  config_overrides: Record<string, unknown> | null;
  default_config?: Record<string, unknown> | null;
  is_enabled: boolean;
  status?: "Beta" | "Stable" | "Deprecated" | string;
  icon_key?: string;
  tooltip?: string;
  subscription_tier_required?: string;
  tenant_subscription_tier?: string;
  is_locked?: boolean;
  api_consumption_30d?: number;
  success_rate_30d?: number;
  avg_latency_ms_30d?: number;
  simulation_preview?: string | null;
  created_at: string;
}

export interface SkillConfigSimulateResponse {
  skill_type: string;
  summary: string;
  confidence: number;
  sample_output: Record<string, unknown>;
  simulated_at: string;
}

export interface SkillUsageTimeseriesPointResponse {
  day: string;
  count: number;
}

export interface SkillUsageTimeseriesResponse {
  skill_type: string;
  points: SkillUsageTimeseriesPointResponse[];
}

export interface PolicyRuleResponse {
  id: string;
  tenant_id: string | null;
  name: string;
  rule_type: string;
  config: Record<string, unknown> | null;
  is_required: boolean;
  is_active: boolean;
  version: number;
  created_at: string;
}

export interface PolicyFleetStatusItem {
  policy_id: string;
  name: string;
  rule_type: string;
  is_active: boolean;
  enforcement_mode: string;
  violation_count_24h: number;
  violation_count_7d: number;
  health_score: number;
  status: string;
}

export interface GovernanceOverviewResponse {
  active_threats: number;
  open_violations_24h: number;
  policies_in_strict_block: number;
  policies_in_monitor: number;
  fleet: PolicyFleetStatusItem[];
}

export interface PolicyViolationResponse {
  id: string;
  tenant_id: string;
  policy_rule_id: string | null;
  skill_run_id: string | null;
  violation_type: string;
  severity: string;
  message: string;
  resource_type: string;
  resource_id: string | null;
  deep_link_path: string;
  details: Record<string, unknown> | null;
  enforcement_applied: string;
  created_at: string;
}

export interface PolicyRuleRevisionResponse {
  id: string;
  policy_rule_id: string;
  version: number;
  safety_prompt_snapshot: string;
  config_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogResponse {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface TenantHealthResponse {
  tenant_id: string;
  tenant_name: string;
  total_actions: number;
  total_kb_sources: number;
  total_employees: number;
  total_skill_runs: number;
  skill_success_rate: number;
  avg_latency_ms: number;
}

export interface SkillRunResponse {
  id: string;
  tenant_id: string;
  skill_type: string;
  decision: string | null;
  confidence: number | null;
  latency_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}
