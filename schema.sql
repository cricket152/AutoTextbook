-- 课本工坊数据库 Schema
-- 用于存储教材项目、来源材料、生成内容、版本和会话

-- 项目表：每个教材生成任务
CREATE TABLE app.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  name text NOT NULL,
  subject text, -- 学科
  grade_level text, -- 学段
  learning_goals text, -- 学习目标
  status text NOT NULL DEFAULT 'draft', -- draft, planning, generating, completed, failed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_owner_created_idx ON app.projects (owner_id, created_at DESC);

-- 来源材料表：用户上传的PDF/Markdown
CREATE TABLE app.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  filename text NOT NULL,
  content_type text NOT NULL,
  object_path text NOT NULL, -- Storage路径
  file_hash text, -- 文件哈希
  page_count integer,
  extraction_status text NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  extracted_text text, -- 提取的文本内容
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sources_project_idx ON app.sources (project_id);

-- 知识点表：从材料中识别的知识点
CREATE TABLE app.knowledge_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  prerequisites text[], -- 前置知识点ID
  source_ids uuid[], -- 来源ID
  difficulty_level integer DEFAULT 1, -- 1-5
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_points_project_idx ON app.knowledge_points (project_id);

-- 大纲表：教材目录结构
CREATE TABLE app.outlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  structure jsonb NOT NULL, -- 章节结构
  status text NOT NULL DEFAULT 'draft', -- draft, confirmed, generated
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, version)
);
CREATE INDEX outlines_project_idx ON app.outlines (project_id);

-- 教材版本表：生成的教材内容
CREATE TABLE app.book_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  outline_id uuid NOT NULL REFERENCES app.outlines(id),
  version_number integer NOT NULL DEFAULT 1,
  content jsonb NOT NULL, -- 完整教材内容
  summary text,
  status text NOT NULL DEFAULT 'generating', -- generating, completed, archived
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX book_revisions_project_idx ON app.book_revisions (project_id);

-- 章节修订表：单个章节的内容
CREATE TABLE app.section_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_revision_id uuid NOT NULL REFERENCES app.book_revisions(id) ON DELETE CASCADE,
  section_id text NOT NULL, -- 章节标识
  title text NOT NULL,
  content text NOT NULL, -- Markdown内容
  sources jsonb, -- 引用来源
  figures jsonb, -- 图表数据
  exercises jsonb, -- 练习题
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX section_revisions_book_idx ON app.section_revisions (book_revision_id);

-- 图表表：教材中的图解
CREATE TABLE app.figures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  section_id text,
  title text NOT NULL,
  figure_type text NOT NULL, -- diagram, chart, concept_map, etc.
  data jsonb NOT NULL, -- 图表数据
  object_path text, -- 如果存储为图片
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX figures_project_idx ON app.figures (project_id);

-- 教材Agent配置表：每本教材的专属AI助手配置
CREATE TABLE app.book_agent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  book_revision_id uuid REFERENCES app.book_revisions(id),
  textbook_identity text, -- 教材身份标识
  scope text, -- 范围
  reader_level text, -- 读者基础
  language_style text, -- 语言风格
  case_conventions jsonb, -- 主案例约定
  terminology_index jsonb, -- 术语索引
  available_sources uuid[], -- 可用来源ID
  teaching_preferences jsonb, -- 教学偏好
  prompt_template_version text DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX book_agent_profiles_project_idx ON app.book_agent_profiles (project_id);

-- 会话表：用户与Agent的对话
CREATE TABLE app.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  book_revision_id uuid REFERENCES app.book_revisions(id),
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_project_idx ON app.conversations (project_id);

-- 消息表：会话中的消息
CREATE TABLE app.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES app.conversations(id) ON DELETE CASCADE,
  role text NOT NULL, -- user, assistant, system
  content text NOT NULL,
  sources jsonb, -- 引用来源
  patch_proposal jsonb, -- 修改提案
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON app.messages (conversation_id, created_at);

-- 修改提案表：Agent提出的教材修改
CREATE TABLE app.patch_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  book_revision_id uuid NOT NULL REFERENCES app.book_revisions(id),
  section_id text NOT NULL,
  base_revision_id uuid NOT NULL REFERENCES app.section_revisions(id),
  old_content_hash text,
  new_content text NOT NULL,
  reason text,
  sources jsonb,
  impact_scope jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending, applied, rejected, expired
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);
CREATE INDEX patch_proposals_project_idx ON app.patch_proposals (project_id);

-- 任务表：异步工作流任务
CREATE TABLE app.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  job_type text NOT NULL, -- extract, generate_outline, generate_chapter, export, etc.
  status text NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  stage text, -- 当前阶段
  progress jsonb, -- 进度信息
  result jsonb, -- 结果数据
  error text, -- 错误信息
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_project_idx ON app.jobs (project_id, created_at DESC);
CREATE INDEX jobs_status_idx ON app.jobs (status) WHERE status IN ('pending', 'running');

-- 导出记录表
CREATE TABLE app.exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  book_revision_id uuid NOT NULL REFERENCES app.book_revisions(id),
  export_type text NOT NULL, -- markdown, pdf
  object_path text NOT NULL,
  file_size integer,
  status text NOT NULL DEFAULT 'pending', -- pending, ready, expired
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exports_project_idx ON app.exports (project_id);
