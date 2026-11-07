import { useState, useRef } from 'react'
import { api, Project, Source, errorMessage } from '../lib/api'

interface Props {
  project: Project | null
  onComplete: (project: Project) => void
  onBack: () => void
}

export default function WizardPage({ project, onComplete, onBack }: Props) {
  const [step, setStep] = useState<'info' | 'upload' | 'goals'>(project ? 'upload' : 'info')
  const [name, setName] = useState(project?.name || '')
  const [subject, setSubject] = useState(project?.subject || '')
  const [gradeLevel, setGradeLevel] = useState(project?.grade_level || '')
  const [learningGoals, setLearningGoals] = useState(project?.learning_goals || '')
  const [sources, setSources] = useState<Source[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentProject, setCurrentProject] = useState<Project | null>(project)

  async function createProject() {
    if (!name.trim()) {
      setError('请输入项目名称')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const p = await api.createProject({
        name: name.trim(),
        subject: subject || undefined,
        grade_level: gradeLevel || undefined
      })
      setCurrentProject(p)
      setStep('upload')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0 || !currentProject) return

    setUploading(true)
    setError(null)

    try {
      for (const file of Array.from(files)) {
        // 检查文件类型
        const allowedTypes = ['application/pdf', 'text/markdown', 'text/plain']
        if (!allowedTypes.includes(file.type) && !file.name.endsWith('.md') && !file.name.endsWith('.pdf')) {
          setError(`不支持的文件类型: ${file.name}。仅支持 PDF 和 Markdown 文件。`)
          setUploading(false)
          return
        }

        // 检查文件大小 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          setError(`文件过大: ${file.name}。最大支持 10MB。`)
          setUploading(false)
          return
        }

        // 创建上传记录
        const { id, signedUrl } = await api.uploadSource(
          currentProject.id,
          file.name,
          file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/markdown')
        )

        // 上传文件到存储
        const response = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file
        })

        if (!response.ok) {
          throw new Error('上传失败')
        }

        // 确认上传完成
        await api.completeSourceUpload(id)

        // 添加到列表
        setSources([...sources, {
          id,
          filename: file.name,
          content_type: file.type,
          extraction_status: 'processing'
        }])
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function saveGoalsAndContinue() {
    if (!currentProject) return
    setLoading(true)
    setError(null)
    try {
      const updated = await api.updateProject(currentProject.id, {
        learning_goals: learningGoals,
        status: 'planning'
      })
      onComplete({ ...currentProject, ...updated })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="wizard-page">
      <div className="wizard-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← 返回
        </button>
        <div className="step-indicator">
          <span className={step === 'info' ? 'active' : 'completed'}>
            1. 基本信息
          </span>
          <span className={step === 'upload' ? 'active' : step === 'goals' ? 'completed' : ''}>
            2. 上传资料
          </span>
          <span className={step === 'goals' ? 'active' : ''}>
            3. 学习目标
          </span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {step === 'info' && (
        <div className="wizard-step">
          <h2>创建新项目</h2>
          <p className="step-description">
            给你的教材项目起个名字，选择学科和学段
          </p>

          <div className="form-group">
            <label htmlFor="name">项目名称 *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Python编程入门教材"
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label htmlFor="subject">学科</label>
            <select
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">请选择学科</option>
              <option value="computer_science">计算机科学</option>
              <option value="math">数学</option>
              <option value="physics">物理</option>
              <option value="chemistry">化学</option>
              <option value="biology">生物</option>
              <option value="english">英语</option>
              <option value="chinese">语文</option>
              <option value="history">历史</option>
              <option value="other">其他</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="grade">学段</label>
            <select
              id="grade"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
            >
              <option value="">请选择学段</option>
              <option value="high_school">高中</option>
              <option value="undergraduate">大学本科</option>
              <option value="graduate">研究生</option>
              <option value="self_learner">自学</option>
            </select>
          </div>

          <div className="wizard-actions">
            <button
              className="btn btn-primary"
              onClick={createProject}
              disabled={loading || !name.trim()}
            >
              {loading ? '创建中...' : '下一步'}
            </button>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <div className="wizard-step">
          <h2>上传学习资料</h2>
          <p className="step-description">
            上传你的课件、笔记或其他学习材料。支持 PDF 和 Markdown 格式，单个文件最大 10MB。
          </p>
          <p className="step-hint">
            💡 提示：如果你只有 PPT 格式，可以先将其转换为 PDF 再上传。
          </p>

          <div className="upload-area">
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              multiple
              accept=".pdf,.md,.markdown,.txt"
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-upload" className="upload-label">
              <div className="upload-icon">📁</div>
              <p>{uploading ? '上传中...' : '点击选择文件或拖拽到此处'}</p>
              <p className="upload-hint">PDF, Markdown, 文本文件</p>
            </label>
          </div>

          {sources.length > 0 && (
            <div className="sources-list">
              <h3>已上传的资料 ({sources.length})</h3>
              {sources.map(source => (
                <div key={source.id} className="source-item">
                  <span className="source-icon">
                    {source.content_type.includes('pdf') ? '📄' : '📝'}
                  </span>
                  <span className="source-name">{source.filename}</span>
                  <span className={`source-status status-${source.extraction_status}`}>
                    {source.extraction_status === 'pending' && '等待处理'}
                    {source.extraction_status === 'processing' && '处理中...'}
                    {source.extraction_status === 'completed' && '✓ 已完成'}
                    {source.extraction_status === 'failed' && '✗ 失败'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="wizard-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setStep('info')}
            >
              上一步
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep('goals')}
              disabled={sources.length === 0}
            >
              下一步
            </button>
          </div>
        </div>
      )}

      {step === 'goals' && (
        <div className="wizard-step">
          <h2>设定学习目标</h2>
          <p className="step-description">
            告诉 AI 你希望通过这份教材达到什么学习目标，以及你的基础水平。
          </p>

          <div className="form-group">
            <label htmlFor="goals">学习目标与基础</label>
            <textarea
              id="goals"
              value={learningGoals}
              onChange={(e) => setLearningGoals(e.target.value)}
              placeholder="例如：我是计算机专业大一学生，已经学过 C 语言，想系统学习 Python 编程。希望教材能包含基础语法、常用库、实战项目等内容。"
              rows={6}
            />
          </div>

          <div className="goals-suggestions">
            <h4>可以参考以下方面：</h4>
            <ul>
              <li>你目前的基础水平</li>
              <li>希望掌握的核心知识点</li>
              <li>学习深度（入门/进阶/深入）</li>
              <li>是否需要实践案例</li>
              <li>特殊要求（如重点讲解某部分）</li>
            </ul>
          </div>

          <div className="wizard-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setStep('upload')}
            >
              上一步
            </button>
            <button
              className="btn btn-primary"
              onClick={saveGoalsAndContinue}
              disabled={loading}
            >
              {loading ? '保存中...' : '开始规划教材'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .wizard-page {
          max-width: 800px;
          margin: 0 auto;
        }
        .wizard-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .step-indicator {
          display: flex;
          gap: 0.5rem;
          flex: 1;
          justify-content: center;
        }
        .step-indicator span {
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          font-size: 0.85rem;
          background: var(--bg);
          color: var(--text-secondary);
        }
        .step-indicator span.active {
          background: var(--primary);
          color: white;
        }
        .step-indicator span.completed {
          background: var(--success);
          color: white;
        }
        .wizard-step {
          background: var(--surface);
          padding: 2rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
        }
        .wizard-step h2 {
          margin-bottom: 0.5rem;
        }
        .step-description {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }
        .step-hint {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          padding: 0.75rem 1rem;
          border-radius: var(--radius);
          font-size: 0.9rem;
          margin-bottom: 1.5rem;
        }
        .error-message {
          background: #fef2f2;
          color: var(--error);
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1rem;
          border: 1px solid #fecaca;
        }
        .upload-area {
          border: 2px dashed var(--border);
          border-radius: var(--radius);
          padding: 3rem;
          text-align: center;
          margin-bottom: 1.5rem;
          transition: all 0.2s;
        }
        .upload-area:hover {
          border-color: var(--primary);
          background: #f5f3ff;
        }
        .upload-label {
          cursor: pointer;
        }
        .upload-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .upload-hint {
          color: var(--text-secondary);
          font-size: 0.85rem;
          margin-top: 0.5rem;
        }
        .sources-list {
          margin-bottom: 1.5rem;
        }
        .sources-list h3 {
          font-size: 1rem;
          margin-bottom: 1rem;
        }
        .source-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: var(--bg);
          border-radius: var(--radius);
          margin-bottom: 0.5rem;
        }
        .source-icon {
          font-size: 1.5rem;
        }
        .source-name {
          flex: 1;
        }
        .source-status {
          font-size: 0.85rem;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
        }
        .source-status.status-pending {
          background: #fef3c7;
          color: #92400e;
        }
        .source-status.status-processing {
          background: #dbeafe;
          color: #1e40af;
        }
        .source-status.status-completed {
          background: #d1fae5;
          color: #065f46;
        }
        .source-status.status-failed {
          background: #fee2e2;
          color: #991b1b;
        }
        .goals-suggestions {
          background: var(--bg);
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1.5rem;
        }
        .goals-suggestions h4 {
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
        }
        .goals-suggestions ul {
          margin-left: 1.5rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }
        .goals-suggestions li {
          margin-bottom: 0.25rem;
        }
        .wizard-actions {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          margin-top: 2rem;
        }
      `}</style>
    </div>
  )
}
