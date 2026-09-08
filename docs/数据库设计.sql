-- BioFlow Studio production-target data model
-- Target: PostgreSQL 15+
-- Updated: 2026-09-08
--
-- The local interview build intentionally uses JSON + SQLite + Qdrant Local +
-- filesystem objects so it can start without Docker. This DDL is the normalized
-- production target and is not executed by the current local startup command.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TABLE roles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                varchar(32) NOT NULL UNIQUE,
  name                varchar(64) NOT NULL,
  description         varchar(500) NOT NULL DEFAULT '',
  system_role         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT roles_code_format CHECK (code ~ '^[a-z][a-z0-9_-]{1,31}$')
);

CREATE TABLE permissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                varchar(64) NOT NULL UNIQUE,
  name                varchar(80) NOT NULL,
  resource            varchar(40) NOT NULL,
  action              varchar(40) NOT NULL,
  description         varchar(500) NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT permissions_code_format CHECK (code ~ '^[a-z]+:[a-z]+$')
);

CREATE TABLE role_permissions (
  role_id             uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id       uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username            varchar(32) NOT NULL UNIQUE,
  display_name        varchar(80) NOT NULL,
  password_hash       varchar(255) NOT NULL,
  password_salt       varchar(255) NOT NULL,
  role_id             uuid NOT NULL REFERENCES roles(id),
  enabled             boolean NOT NULL DEFAULT true,
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          timestamptz,
  CONSTRAINT users_username_format CHECK (username ~ '^[a-z][a-z0-9._-]{2,31}$')
);

CREATE TABLE user_permissions (
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id       uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  effect              varchar(8) NOT NULL DEFAULT 'allow',
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  CONSTRAINT user_permissions_effect CHECK (effect IN ('allow', 'deny'))
);

CREATE TABLE access_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          varchar(128) NOT NULL UNIQUE,
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  user_agent          varchar(500),
  ip_address          inet,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key         varchar(40) NOT NULL UNIQUE,
  name                varchar(120) NOT NULL,
  description         text NOT NULL DEFAULT '',
  owner_id            uuid NOT NULL REFERENCES users(id),
  protected           boolean NOT NULL DEFAULT false,
  status              varchar(20) NOT NULL DEFAULT 'active',
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at         timestamptz,
  CONSTRAINT projects_status CHECK (status IN ('active', 'archived'))
);

CREATE TABLE project_members (
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_role     varchar(20) NOT NULL DEFAULT 'member',
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_members_role CHECK (
    membership_role IN ('owner', 'member', 'reviewer')
  )
);

CREATE TABLE skills (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_key           varchar(80) NOT NULL UNIQUE,
  name                varchar(160) NOT NULL,
  category            varchar(80) NOT NULL,
  description         text NOT NULL,
  source              varchar(32) NOT NULL,
  version             varchar(40) NOT NULL,
  status              varchar(20) NOT NULL DEFAULT 'available',
  enabled             boolean NOT NULL DEFAULT true,
  inputs_schema       jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs_schema      jsonb NOT NULL DEFAULT '{}'::jsonb,
  instructions        text,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT skills_source CHECK (
    source IN ('bioflow_lab', 'team', 'community', 'mine')
  ),
  CONSTRAINT skills_status CHECK (status IN ('available', 'deprecated'))
);

CREATE TABLE tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key            varchar(80) NOT NULL UNIQUE,
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by          uuid NOT NULL REFERENCES users(id),
  skill_id            uuid REFERENCES skills(id),
  title               varchar(240) NOT NULL,
  goal                text NOT NULL DEFAULT '',
  status              varchar(32) NOT NULL DEFAULT 'draft',
  progress            smallint NOT NULL DEFAULT 0,
  execution_mode      varchar(12) NOT NULL DEFAULT 'real',
  clarification       jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan                jsonb,
  notes               text NOT NULL DEFAULT '',
  current_run_id      uuid,
  current_analysis_job_id uuid,
  lock_version        integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          timestamptz,
  CONSTRAINT tasks_status CHECK (
    status IN (
      'draft', 'clarifying', 'awaiting_approval', 'queued', 'running',
      'succeeded', 'failed', 'cancelled'
    )
  ),
  CONSTRAINT tasks_progress CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT tasks_execution_mode CHECK (execution_mode IN ('real', 'demo'))
);

CREATE TABLE task_skills (
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  skill_id            uuid NOT NULL REFERENCES skills(id),
  skill_version       varchar(40) NOT NULL,
  configuration       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, skill_id)
);

CREATE TABLE documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_key            varchar(80) NOT NULL UNIQUE,
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by         uuid NOT NULL REFERENCES users(id),
  original_name       varchar(500) NOT NULL,
  media_type          varchar(160) NOT NULL,
  format              varchar(20) NOT NULL,
  size_bytes          bigint NOT NULL,
  sha256              char(64) NOT NULL,
  object_key          varchar(1000) NOT NULL,
  source              varchar(20) NOT NULL DEFAULT 'user_upload',
  parser              varchar(120),
  parser_version      varchar(40),
  parse_status        varchar(24) NOT NULL DEFAULT 'pending',
  index_status        varchar(24) NOT NULL DEFAULT 'pending',
  needs_ocr           boolean NOT NULL DEFAULT false,
  character_count     integer NOT NULL DEFAULT 0,
  section_count       integer NOT NULL DEFAULT 0,
  chunk_count         integer NOT NULL DEFAULT 0,
  embedding_model     varchar(240),
  embedding_dimensions integer,
  warnings            jsonb NOT NULL DEFAULT '[]'::jsonb,
  parse_error         text,
  indexed_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          timestamptz,
  CONSTRAINT documents_size CHECK (size_bytes > 0),
  CONSTRAINT documents_source CHECK (source IN ('demo_seed', 'user_upload')),
  CONSTRAINT documents_parse_status CHECK (
    parse_status IN ('pending', 'parsing', 'ready', 'needs_ocr', 'failed', 'empty')
  ),
  CONSTRAINT documents_index_status CHECK (
    index_status IN ('pending', 'indexing', 'indexed', 'needs_ocr', 'failed', 'empty')
  )
);

CREATE TABLE task_files (
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  document_id         uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  purpose             varchar(40) NOT NULL DEFAULT 'evidence',
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, document_id),
  CONSTRAINT task_files_purpose CHECK (
    purpose IN ('counts', 'metadata', 'evidence', 'protocol', 'structure', 'other')
  )
);

CREATE TABLE document_chunks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index         integer NOT NULL,
  text_content        text NOT NULL,
  token_count         integer NOT NULL DEFAULT 0,
  locator             varchar(240),
  origin              varchar(240),
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash        char(64) NOT NULL,
  qdrant_collection   varchar(160),
  qdrant_point_id     uuid,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_id, chunk_index),
  CONSTRAINT document_chunks_index CHECK (chunk_index >= 0),
  CONSTRAINT document_chunks_text CHECK (length(text_content) > 0)
);

CREATE TABLE workflow_nodes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  node_key            varchar(80) NOT NULL,
  label               varchar(240) NOT NULL,
  kind                varchar(40) NOT NULL,
  status              varchar(24) NOT NULL DEFAULT 'blocked',
  detail              text NOT NULL DEFAULT '',
  error_message       text,
  position_x          numeric(12, 3) NOT NULL DEFAULT 0,
  position_y          numeric(12, 3) NOT NULL DEFAULT 0,
  configuration       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, node_key),
  CONSTRAINT workflow_nodes_status CHECK (
    status IN ('blocked', 'queued', 'running', 'succeeded', 'failed', 'cancelled')
  )
);

CREATE TABLE workflow_edges (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  source_node_id      uuid NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  target_node_id      uuid NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  edge_type           varchar(24) NOT NULL DEFAULT 'control',
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, source_node_id, target_node_id),
  CONSTRAINT workflow_edges_not_self CHECK (source_node_id <> target_node_id)
);

CREATE TABLE workflow_layouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name                varchar(120) NOT NULL,
  revision            integer NOT NULL,
  node_positions      jsonb NOT NULL,
  extra_edges         jsonb NOT NULL DEFAULT '[]'::jsonb,
  zoom                numeric(8, 4) NOT NULL DEFAULT 1,
  pan_x               numeric(12, 3) NOT NULL DEFAULT 0,
  pan_y               numeric(12, 3) NOT NULL DEFAULT 0,
  is_current          boolean NOT NULL DEFAULT false,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, revision),
  CONSTRAINT workflow_layouts_revision CHECK (revision >= 0),
  CONSTRAINT workflow_layouts_zoom CHECK (zoom BETWEEN 0.2 AND 3)
);

CREATE UNIQUE INDEX workflow_layouts_one_current
  ON workflow_layouts(task_id)
  WHERE is_current = true;

CREATE TABLE runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key             varchar(100) NOT NULL UNIQUE,
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by        uuid NOT NULL REFERENCES users(id),
  status              varchar(24) NOT NULL DEFAULT 'queued',
  runner              varchar(80) NOT NULL,
  input_snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_summary      jsonb,
  error_code          varchar(80),
  error_message       text,
  started_at          timestamptz,
  finished_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT runs_status CHECK (
    status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  )
);

ALTER TABLE tasks
  ADD CONSTRAINT tasks_current_run_fk
  FOREIGN KEY (current_run_id) REFERENCES runs(id) ON DELETE SET NULL;

CREATE TABLE run_events (
  id                  bigserial PRIMARY KEY,
  run_id              uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  sequence_no         bigint NOT NULL,
  event_type          varchar(100) NOT NULL,
  node_id             uuid REFERENCES workflow_nodes(id) ON DELETE SET NULL,
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (run_id, sequence_no)
);

CREATE TABLE rag_traces (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_key           varchar(100) NOT NULL UNIQUE,
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  run_id              uuid REFERENCES runs(id) ON DELETE SET NULL,
  query               text NOT NULL,
  normalized_query    text NOT NULL,
  agent_mode          varchar(24) NOT NULL,
  reasoning_effort    varchar(12) NOT NULL,
  status              varchar(20) NOT NULL DEFAULT 'running',
  index_provider      varchar(40),
  collection_name     varchar(160),
  embedding_model     varchar(240),
  retrieval_strategy  varchar(120),
  request_snapshot    jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot     jsonb,
  duration_ms         integer NOT NULL DEFAULT 0,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at        timestamptz,
  CONSTRAINT rag_traces_mode CHECK (
    agent_mode IN ('快速模式', '标准模式', '深度研究')
  ),
  CONSTRAINT rag_traces_effort CHECK (reasoning_effort IN ('low', 'medium', 'high')),
  CONSTRAINT rag_traces_status CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE TABLE rag_trace_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id            uuid NOT NULL REFERENCES rag_traces(id) ON DELETE CASCADE,
  stage               varchar(32) NOT NULL,
  sequence_no         integer NOT NULL,
  document_id         uuid REFERENCES documents(id) ON DELETE SET NULL,
  chunk_id            uuid REFERENCES document_chunks(id) ON DELETE SET NULL,
  score               numeric(12, 8),
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (trace_id, stage, sequence_no),
  CONSTRAINT rag_trace_items_stage CHECK (
    stage IN ('documents', 'chunks', 'retrieval', 'rerank', 'graph', 'grounding', 'tools')
  )
);

CREATE TABLE analysis_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key             varchar(100) NOT NULL UNIQUE,
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  run_id              uuid REFERENCES runs(id) ON DELETE SET NULL,
  engine              varchar(80) NOT NULL DEFAULT 'PyDESeq2',
  engine_version      varchar(40),
  status              varchar(24) NOT NULL DEFAULT 'queued',
  counts_document_id  uuid NOT NULL REFERENCES documents(id),
  metadata_document_id uuid NOT NULL REFERENCES documents(id),
  condition_column    varchar(80) NOT NULL,
  control_label       varchar(120) NOT NULL,
  treated_label       varchar(120) NOT NULL,
  batch_column        varchar(80),
  alpha               numeric(7, 6) NOT NULL DEFAULT 0.05,
  parameters          jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary      jsonb,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at          timestamptz,
  finished_at         timestamptz,
  CONSTRAINT analysis_jobs_status CHECK (
    status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  CONSTRAINT analysis_jobs_distinct_files CHECK (
    counts_document_id <> metadata_document_id
  ),
  CONSTRAINT analysis_jobs_distinct_groups CHECK (control_label <> treated_label),
  CONSTRAINT analysis_jobs_alpha CHECK (alpha > 0 AND alpha < 1)
);

ALTER TABLE tasks
  ADD CONSTRAINT tasks_current_analysis_job_fk
  FOREIGN KEY (current_analysis_job_id) REFERENCES analysis_jobs(id) ON DELETE SET NULL;

CREATE TABLE artifacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_key        varchar(120) NOT NULL UNIQUE,
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  run_id              uuid REFERENCES runs(id) ON DELETE SET NULL,
  analysis_job_id     uuid REFERENCES analysis_jobs(id) ON DELETE SET NULL,
  source_node_id      uuid REFERENCES workflow_nodes(id) ON DELETE SET NULL,
  kind                varchar(32) NOT NULL,
  name                varchar(300) NOT NULL,
  media_type          varchar(160) NOT NULL,
  object_key          varchar(1000) NOT NULL,
  size_bytes          bigint,
  sha256              char(64),
  version             varchar(40) NOT NULL DEFAULT '1',
  summary             jsonb NOT NULL DEFAULT '{}'::jsonb,
  lineage             jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT artifacts_kind CHECK (
    kind IN ('chart', 'report', 'code', 'table', 'structure', 'log', 'other')
  )
);

CREATE TABLE conversation_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  message_key         varchar(120) NOT NULL,
  role                varchar(16) NOT NULL,
  content             text NOT NULL,
  status              varchar(20) NOT NULL,
  trace_id            uuid REFERENCES rag_traces(id) ON DELETE SET NULL,
  citations           jsonb NOT NULL DEFAULT '[]'::jsonb,
  feedback            varchar(8),
  created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, message_key),
  CONSTRAINT conversation_messages_role CHECK (role IN ('user', 'assistant')),
  CONSTRAINT conversation_messages_status CHECK (
    status IN ('sending', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT conversation_messages_feedback CHECK (
    feedback IS NULL OR feedback IN ('up', 'down')
  )
);

CREATE INDEX users_role_enabled_idx ON users(role_id, enabled) WHERE deleted_at IS NULL;
CREATE INDEX access_sessions_user_expiry_idx ON access_sessions(user_id, expires_at);
CREATE INDEX projects_owner_status_idx ON projects(owner_id, status);
CREATE INDEX project_members_user_idx ON project_members(user_id, project_id);
CREATE INDEX tasks_project_updated_idx ON tasks(project_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX tasks_status_idx ON tasks(status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX documents_project_updated_idx ON documents(project_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX documents_sha256_idx ON documents(sha256) WHERE deleted_at IS NULL;
CREATE INDEX documents_index_status_idx ON documents(index_status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX document_chunks_document_idx ON document_chunks(document_id, chunk_index);
CREATE INDEX workflow_nodes_task_status_idx ON workflow_nodes(task_id, status);
CREATE INDEX workflow_edges_task_idx ON workflow_edges(task_id);
CREATE INDEX runs_task_created_idx ON runs(task_id, created_at DESC);
CREATE INDEX runs_active_idx ON runs(status, created_at) WHERE status IN ('queued', 'running');
CREATE INDEX run_events_resume_idx ON run_events(run_id, sequence_no);
CREATE INDEX rag_traces_task_created_idx ON rag_traces(task_id, created_at DESC);
CREATE INDEX rag_trace_items_trace_stage_idx ON rag_trace_items(trace_id, stage, sequence_no);
CREATE INDEX analysis_jobs_task_created_idx ON analysis_jobs(task_id, created_at DESC);
CREATE INDEX analysis_jobs_active_idx ON analysis_jobs(status, created_at) WHERE status IN ('queued', 'running');
CREATE INDEX artifacts_task_created_idx ON artifacts(task_id, created_at DESC);
CREATE INDEX conversation_messages_task_created_idx ON conversation_messages(task_id, created_at);

CREATE TRIGGER roles_set_updated_at BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER skills_set_updated_at BEFORE UPDATE ON skills
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workflow_nodes_set_updated_at BEFORE UPDATE ON workflow_nodes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO roles (code, name, description, system_role)
VALUES
  ('researcher', '研究员', '创建任务、上传材料、运行智能体与真实计算。', true),
  ('reviewer', '审阅者', '只读检查任务、文件、证据与结果，并填写审阅意见。', true),
  ('admin', '管理员', '管理用户、角色和权限，并拥有工作台全部能力。', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, resource, action, description)
VALUES
  ('tasks:read', '查看任务', 'tasks', 'read', '读取项目任务与工作流状态'),
  ('tasks:write', '创建与编辑任务', 'tasks', 'write', '创建、编辑和删除任务'),
  ('files:read', '查看项目文件', 'files', 'read', '读取文件目录、正文和原件'),
  ('files:write', '管理项目文件', 'files', 'write', '上传、重新解析和删除文件'),
  ('skills:read', '查看能力中心', 'skills', 'read', '读取技能目录与详情'),
  ('skills:write', '管理科研技能', 'skills', 'write', '创建技能并修改启用状态'),
  ('runs:execute', '执行工作流', 'runs', 'execute', '生成计划、检索和运行计算'),
  ('reviews:write', '填写审阅意见', 'reviews', 'write', '写入任务研究笔记和审阅意见'),
  ('users:manage', '管理用户与权限', 'users', 'manage', '创建用户、分配角色和权限')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'researcher' AND p.code IN (
    'tasks:read', 'tasks:write', 'files:read', 'files:write',
    'skills:read', 'runs:execute', 'reviews:write'
  )) OR
  (r.code = 'reviewer' AND p.code IN (
    'tasks:read', 'files:read', 'skills:read', 'reviews:write'
  )) OR
  (r.code = 'admin')
)
ON CONFLICT DO NOTHING;

COMMIT;
