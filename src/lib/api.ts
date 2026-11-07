// API 客户端
export class RequestError extends Error {
  code: string;
  status: number;
  uncertain: boolean;

  constructor(code: string, status = 0, uncertain = false) {
    super(code);
    this.code = code;
    this.status = status;
    this.uncertain = uncertain;
  }
}

export async function requestBackend(path: string, init?: RequestInit): Promise<any> {
  let response: Response;
  try {
    response = await fetch(`/functions/v1/app${path}`, {
      ...init,
      credentials: 'same-origin',
      signal: init?.signal ?? AbortSignal.timeout(30000)
    });
  } catch {
    throw new RequestError('network_error', 0, true);
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new RequestError('invalid_response', response.status, true);
  }

  if (!response.ok) {
    throw new RequestError(
      typeof body?.error === 'string' ? body.error : 'request_failed',
      response.status,
      response.status >= 500 || response.status === 408
    );
  }

  return body;
}

export function errorMessage(error: unknown): string {
  const code = error instanceof RequestError ? error.code : '';
  const messages: Record<string, string> = {
    login_required: '请先登录后再操作',
    not_found: '请求的资源不存在',
    invalid_input: '输入内容有误，请检查后重试',
    write_conflict: '内容已被修改，请刷新后重试',
    upload_pending: '文件上传未完成，请等待确认',
    invalid_upload: '不支持的文件类型或文件过大',
    database_not_configured: '数据服务尚未配置',
    database_credential_rejected: '数据服务暂不可用',
    network_error: '网络连接中断，请检查网络后重试',
    invalid_response: '服务返回结果异常',
    service_not_configured: 'AI服务尚未配置，生成功能暂不可用'
  };
  return messages[code] || '操作失败，请稍后重试';
}

// 类型定义
export interface Project {
  id: string;
  name: string;
  subject?: string;
  grade_level?: string;
  learning_goals?: string;
  status: 'draft' | 'planning' | 'generating' | 'completed' | 'failed';
  created_at?: string;
  updated_at?: string;
}

export interface Source {
  id: string;
  filename: string;
  content_type: string;
  page_count?: number;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at?: string;
}

export interface Outline {
  id: string;
  version: number;
  structure: OutlineStructure;
  status: 'draft' | 'confirmed' | 'generated';
  created_at?: string;
}

export interface OutlineStructure {
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  title: string;
  sections: Section[];
}

export interface Section {
  id: string;
  title: string;
  knowledge_points: string[];
}

export interface BookRevision {
  id: string;
  version_number: number;
  summary?: string;
  status: 'generating' | 'completed' | 'archived';
  created_at?: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: any;
  patch_proposal?: any;
  created_at?: string;
}

export interface Job {
  id: string;
  job_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  stage?: string;
  progress?: any;
  error?: string;
  created_at?: string;
  completed_at?: string;
}

// API 方法
export const api = {
  // 项目
  async listProjects(): Promise<Project[]> {
    return requestBackend('/api/projects');
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    return requestBackend('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async getProject(id: string): Promise<Project> {
    return requestBackend(`/api/projects/${id}`);
  },

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    return requestBackend(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async deleteProject(id: string): Promise<void> {
    return requestBackend(`/api/projects/${id}`, { method: 'DELETE' });
  },

  // 来源材料
  async listSources(projectId: string): Promise<Source[]> {
    return requestBackend(`/api/projects/${projectId}/sources`);
  },

  async uploadSource(projectId: string, filename: string, contentType: string): Promise<{ id: string; signedUrl: string }> {
    return requestBackend(`/api/projects/${projectId}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content_type: contentType })
    });
  },

  async completeSourceUpload(sourceId: string): Promise<void> {
    return requestBackend(`/api/sources/${sourceId}/complete`, { method: 'POST' });
  },

  // 大纲
  async getOutline(projectId: string): Promise<Outline | null> {
    return requestBackend(`/api/projects/${projectId}/outline`);
  },

  async saveOutline(projectId: string, structure: OutlineStructure, status?: string): Promise<Outline> {
    return requestBackend(`/api/projects/${projectId}/outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structure, status })
    });
  },

  // 教材版本
  async listRevisions(projectId: string): Promise<BookRevision[]> {
    return requestBackend(`/api/projects/${projectId}/revisions`);
  },

  async getRevision(revisionId: string): Promise<any> {
    return requestBackend(`/api/revisions/${revisionId}`);
  },

  // 会话
  async listConversations(projectId: string): Promise<Conversation[]> {
    return requestBackend(`/api/projects/${projectId}/conversations`);
  },

  async createConversation(projectId: string, data?: { title?: string; book_revision_id?: string }): Promise<Conversation> {
    return requestBackend(`/api/projects/${projectId}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    });
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    return requestBackend(`/api/conversations/${conversationId}/messages`);
  },

  async sendMessage(conversationId: string, content: string): Promise<{ userMessage: Message; assistantMessage: Message }> {
    return requestBackend(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  },

  // 任务
  async listJobs(projectId: string): Promise<Job[]> {
    return requestBackend(`/api/projects/${projectId}/jobs`);
  },

  async createJob(projectId: string, jobType: string, params?: any): Promise<Job> {
    return requestBackend(`/api/projects/${projectId}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_type: jobType, params })
    });
  },

  async getJob(jobId: string): Promise<Job> {
    return requestBackend(`/api/jobs/${jobId}`);
  },

  async cancelJob(jobId: string): Promise<void> {
    return requestBackend(`/api/jobs/${jobId}`, { method: 'POST' });
  },

  // 导出
  async requestExport(revisionId: string, format: 'markdown' | 'pdf'): Promise<{ id: string }> {
    return requestBackend(`/api/revisions/${revisionId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format })
    });
  },

  async downloadExport(exportId: string): Promise<{ signedUrl: string }> {
    return requestBackend(`/api/exports/${exportId}/download`);
  },

  // 修改提案
  async listPatches(projectId: string): Promise<any[]> {
    return requestBackend(`/api/projects/${projectId}/patches`);
  },

  async applyPatch(patchId: string): Promise<void> {
    return requestBackend(`/api/patches/${patchId}/apply`, { method: 'POST' });
  },

  async rejectPatch(patchId: string): Promise<void> {
    return requestBackend(`/api/patches/${patchId}/reject`, { method: 'POST' });
  }
};
