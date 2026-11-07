import { useState, useEffect } from 'react'
import { api, Project, Outline, OutlineStructure, Chapter, Job, errorMessage } from '../lib/api'

interface Props {
  project: Project
  onStartGenerate: (project: Project) => void
  onBack: () => void
}

export default function PlanningPage({ project, onStartGenerate, onBack }: Props) {
  const [outline, setOutline] = useState<Outline | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editStructure, setEditStructure] = useState<OutlineStructure | null>(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadJobs, 3000)
    return () => clearInterval(interval)
  }, [project.id])

  async function loadData() {
    setLoading(true)
    try {
      const [outlineData, jobsData] = await Promise.all([
        api.getOutline(project.id),
        api.listJobs(project.id)
      ])
      setOutline(outlineData)
      setJobs(jobsData)
      if (outlineData) {
        setEditStructure(outlineData.structure)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadJobs() {
    try {
      const jobsData = await api.listJobs(project.id)
      setJobs(jobsData)
    } catch {}
  }

  async function generateOutline() {
    setGenerating(true)
    setError(null)
    try {
      const job = await api.createJob(project.id, 'generate_outline')
      setJobs([job, ...jobs])
      // 轮询任务状态
      pollJobStatus(job.id)
    } catch (err) {
      setError(errorMessage(err))
      setGenerating(false)
    }
  }

  async function pollJobStatus(jobId: string) {
    const maxAttempts = 60
    let attempts = 0
    const poll = async () => {
      attempts++
      try {
        const job = await api.getJob(jobId)
        setJobs(prev => prev.map(j => j.id === jobId ? job : j))
        if (job.status === 'completed') {
          setGenerating(false)
          await loadData()
          return
        }
        if (job.status === 'failed') {
          setGenerating(false)
          setError('大纲生成失败: ' + (job.error || '未知错误'))
          return
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000)
        }
      } catch {
        if (attempts < maxAttempts) setTimeout(poll, 2000)
      }
    }
    poll()
  }

  async function saveOutline() {
    if (!editStructure) return
    setLoading(true)
    setError(null)
    try {
      const saved = await api.saveOutline(project.id, editStructure, 'confirmed')
      setOutline(saved)
      setEditMode(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function startTextbookGeneration() {
    setGenerating(true)
    setError(null)
    try {
      const job = await api.createJob(project.id, 'generate_textbook')
      setJobs([job, ...jobs])
      // 更新项目状态
      await api.updateProject(project.id, { status: 'generating' })
      // 轮询任务状态
      pollGenerationStatus(job.id)
    } catch (err) {
      setError(errorMessage(err))
      setGenerating(false)
    }
  }

  async function pollGenerationStatus(jobId: string) {
    const maxAttempts = 300 // 最长等待10分钟
    let attempts = 0
    const poll = async () => {
      attempts++
      try {
        const job = await api.getJob(jobId)
        setJobs(prev => prev.map(j => j.id === jobId ? job : j))
        if (job.status === 'completed') {
          setGenerating(false)
          const updated = await api.getProject(project.id)
          onStartGenerate(updated)
          return
        }
        if (job.status === 'failed') {
          setGenerating(false)
          setError('教材生成失败: ' + (job.error || '未知错误'))
          return
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000)
        }
      } catch {
        if (attempts < maxAttempts) setTimeout(poll, 2000)
      }
    }
    poll()
  }

  function addChapter() {
    if (!editStructure) return
    const newChapter: Chapter = {
      id: `ch-${Date.now()}`,
      title: '新章节',
      sections: [{
        id: `sec-${Date.now()}`,
        title: '新小节',
        knowledge_points: []
      }]
    }
    setEditStructure({
      ...editStructure,
      chapters: [...editStructure.chapters, newChapter]
    })
  }

  function updateChapterTitle(chapterId: string, title: string) {
    if (!editStructure) return
    setEditStructure({
      ...editStructure,
      chapters: editStructure.chapters.map(ch =>
        ch.id === chapterId ? { ...ch, title } : ch
      )
    })
  }

  function removeChapter(chapterId: string) {
    if (!editStructure) return
    setEditStructure({
      ...editStructure,
      chapters: editStructure.chapters.filter(ch => ch.id !== chapterId)
    })
  }

  function addSection(chapterId: string) {
    if (!editStructure) return
    setEditStructure({
      ...editStructure,
      chapters: editStructure.chapters.map(ch =>
        ch.id === chapterId ? {
          ...ch,
          sections: [...ch.sections, {
            id: `sec-${Date.now()}`,
            title: '新小节',
            knowledge_points: []
          }]
        } : ch
      )
    })
  }

  function updateSectionTitle(chapterId: string, sectionId: string, title: string) {
    if (!editStructure) return
    setEditStructure({
      ...editStructure,
      chapters: editStructure.chapters.map(ch =>
        ch.id === chapterId ? {
          ...ch,
          sections: ch.sections.map(sec =>
            sec.id === sectionId ? { ...sec, title } : sec
          )
        } : ch
      )
    })
  }

  function removeSection(chapterId: string, sectionId: string) {
    if (!editStructure) return
    setEditStructure({
      ...editStructure,
      chapters: editStructure.chapters.map(ch =>
        ch.id === chapterId ? {
          ...ch,
          sections: ch.sections.filter(sec => sec.id !== sectionId)
        } : ch
      )
    })
  }

  if (loading && !outline) {
    return <div className="planning-loading">加载中...</div>
  }

  const activeJob = jobs.find(j => ['pending', 'running'].includes(j.status))
  const isGenerating = generating || !!activeJob

  return (
    <div className="planning-page">
      <div className="planning-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← 返回
        </button>
        <h2>教材规划</h2>
        <div className="header-spacer" />
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* 任务状态 */}
      {activeJob && (
        <div className="job-status">
          <div className="job-info">
            <span className="spinner-small"></span>
            <span>
              {activeJob.job_type === 'generate_outline' && '正在生成大纲...'}
              {activeJob.job_type === 'generate_textbook' && `正在生成教材${activeJob.stage ? ` - ${activeJob.stage}` : ''}...`}
            </span>
          </div>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => api.cancelJob(activeJob.id).then(loadJobs)}
          >
            取消
          </button>
        </div>
      )}

      {/* 大纲区域 */}
      <div className="outline-section">
        <div className="section-header">
          <h3>目录结构</h3>
          <div className="section-actions">
            {!outline && !isGenerating && (
              <button className="btn btn-primary" onClick={generateOutline}>
                AI 生成大纲
              </button>
            )}
            {outline && !editMode && !isGenerating && (
              <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
                编辑大纲
              </button>
            )}
            {editMode && (
              <>
                <button className="btn btn-secondary" onClick={() => {
                  setEditMode(false)
                  setEditStructure(outline?.structure || null)
                }}>
                  取消
                </button>
                <button className="btn btn-primary" onClick={saveOutline} disabled={loading}>
                  保存
                </button>
              </>
            )}
          </div>
        </div>

        {!outline && !isGenerating && (
          <div className="empty-outline">
            <p>还没有生成大纲</p>
            <p className="hint">点击"AI 生成大纲"让 AI 根据你的资料和学习目标生成目录结构</p>
          </div>
        )}

        {(outline || editStructure) && (
          <div className="outline-content">
            {editMode ? (
              <div className="outline-editor">
                {editStructure?.chapters.map((chapter, idx) => (
                  <div key={chapter.id} className="chapter-item">
                    <div className="chapter-header">
                      <span className="chapter-number">第{idx + 1}章</span>
                      <input
                        type="text"
                        value={chapter.title}
                        onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                        className="chapter-title-input"
                      />
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => removeChapter(chapter.id)}
                        title="删除章节"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="sections-list">
                      {chapter.sections.map(section => (
                        <div key={section.id} className="section-item">
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => updateSectionTitle(chapter.id, section.id, e.target.value)}
                            className="section-title-input"
                          />
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => removeSection(chapter.id, section.id)}
                            title="删除小节"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn-add-small"
                        onClick={() => addSection(chapter.id)}
                      >
                        + 添加小节
                      </button>
                    </div>
                  </div>
                ))}
                <button className="btn btn-secondary" onClick={addChapter}>
                  + 添加章节
                </button>
              </div>
            ) : (
              <div className="outline-view">
                {outline?.structure.chapters.map((chapter, idx) => (
                  <div key={chapter.id} className="chapter-view">
                    <h4>第{idx + 1}章: {chapter.title}</h4>
                    <ul>
                      {chapter.sections.map(section => (
                        <li key={section.id}>{section.title}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 生成按钮 */}
      {outline && outline.status === 'confirmed' && !isGenerating && (
        <div className="generate-section">
          <p>大纲已确认，可以开始生成完整教材。</p>
          <button className="btn btn-primary btn-large" onClick={startTextbookGeneration}>
            开始生成教材
          </button>
        </div>
      )}

      {outline && outline.status === 'draft' && !editMode && (
        <div className="confirm-section">
          <p>请检查大纲内容，确认无误后保存。</p>
          <button className="btn btn-primary" onClick={async () => {
            await api.saveOutline(project.id, outline.structure, 'confirmed')
            await loadData()
          }}>
            确认大纲
          </button>
        </div>
      )}

      <style>{`
        .planning-page {
          max-width: 900px;
          margin: 0 auto;
        }
        .planning-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .planning-header h2 {
          flex: 1;
          text-align: center;
        }
        .header-spacer {
          width: 80px;
        }
        .error-message {
          background: #fef2f2;
          color: var(--error);
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1rem;
          border: 1px solid #fecaca;
        }
        .job-status {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: var(--radius);
          padding: 1rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .job-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #1e40af;
        }
        .spinner-small {
          width: 20px;
          height: 20px;
          border: 2px solid #bfdbfe;
          border-top-color: #1e40af;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .btn-small {
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
        }
        .outline-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .section-actions {
          display: flex;
          gap: 0.5rem;
        }
        .empty-outline {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }
        .empty-outline .hint {
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }
        .outline-editor {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .chapter-item {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
        }
        .chapter-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .chapter-number {
          font-weight: 600;
          color: var(--primary);
          white-space: nowrap;
        }
        .chapter-title-input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          font-size: 1rem;
          font-weight: 500;
        }
        .sections-list {
          margin-left: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .section-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .section-title-input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          font-size: 0.9rem;
        }
        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius);
          font-size: 1rem;
        }
        .btn-icon.btn-danger {
          color: var(--error);
        }
        .btn-icon.btn-danger:hover {
          background: #fee2e2;
        }
        .btn-add-small {
          background: none;
          border: 1px dashed var(--border);
          border-radius: var(--radius);
          padding: 0.5rem;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.85rem;
        }
        .btn-add-small:hover {
          border-color: var(--primary);
          color: var(--primary);
        }
        .outline-view {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .chapter-view h4 {
          color: var(--primary);
          margin-bottom: 0.5rem;
        }
        .chapter-view ul {
          margin-left: 1.5rem;
          color: var(--text-secondary);
        }
        .chapter-view li {
          margin-bottom: 0.25rem;
        }
        .generate-section, .confirm-section {
          text-align: center;
          padding: 2rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .generate-section p, .confirm-section p {
          margin-bottom: 1rem;
          color: var(--text-secondary);
        }
        .btn-large {
          padding: 1rem 2rem;
          font-size: 1.1rem;
        }
        .planning-loading {
          text-align: center;
          padding: 4rem;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  )
}
