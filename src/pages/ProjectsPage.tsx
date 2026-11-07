import { useState } from 'react'
import { api, Project, errorMessage } from '../lib/api'

interface Props {
  onSelectProject: (project: Project) => void
  onCreateNew: () => void
}

export default function ProjectsPage({ onSelectProject, onCreateNew }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useState(() => {
    loadProjects()
  })

  async function loadProjects() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listProjects()
      setProjects(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这个项目吗？此操作不可撤销。')) return
    setDeleting(id)
    try {
      await api.deleteProject(id)
      setProjects(projects.filter(p => p.id !== id))
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      draft: '草稿',
      planning: '规划中',
      generating: '生成中',
      completed: '已完成',
      failed: '失败'
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="projects-page">
        <div className="loading">加载中...</div>
      </div>
    )
  }

  return (
    <div className="projects-page">
      <div className="page-header">
        <h2>我的教材项目</h2>
        <button className="btn btn-primary" onClick={onCreateNew}>
          + 新建项目
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {projects.length === 0 ? (
        <div className="empty-state">
          <p>还没有创建任何教材项目</p>
          <button className="btn btn-primary" onClick={onCreateNew}>
            开始创建
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => (
            <div key={project.id} className="card project-card">
              <div className="project-header">
                <h3>{project.name}</h3>
                <span className={`status-badge status-${project.status}`}>
                  {getStatusLabel(project.status)}
                </span>
              </div>
              <div className="project-meta">
                {project.subject && <span>学科: {project.subject}</span>}
                {project.grade_level && <span>学段: {project.grade_level}</span>}
                <span>创建: {new Date(project.created_at || '').toLocaleDateString()}</span>
              </div>
              {project.learning_goals && (
                <p className="project-goals">{project.learning_goals}</p>
              )}
              <div className="project-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => onSelectProject(project)}
                >
                  打开
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(project.id)}
                  disabled={deleting === project.id}
                >
                  {deleting === project.id ? '删除中...' : '删除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .projects-page {
          max-width: 1200px;
          margin: 0 auto;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .page-header h2 {
          font-size: 1.75rem;
        }
        .error-message {
          background: #fef2f2;
          color: var(--error);
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1rem;
        }
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          background: var(--surface);
          border-radius: var(--radius);
          border: 2px dashed var(--border);
        }
        .empty-state p {
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }
        .project-card {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .project-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
        }
        .project-header h3 {
          font-size: 1.25rem;
          flex: 1;
        }
        .project-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        .project-goals {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .project-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: auto;
        }
        .project-actions .btn {
          flex: 1;
        }
      `}</style>
    </div>
  )
}
