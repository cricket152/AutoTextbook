import { useState, useEffect } from 'react'
import { api, Project, errorMessage } from './lib/api'
import HomePage from './pages/HomePage'
import ProjectsPage from './pages/ProjectsPage'
import WizardPage from './pages/WizardPage'
import PlanningPage from './pages/PlanningPage'
import ReaderPage from './pages/ReaderPage'
import './App.css'

type Page = 'home' | 'projects' | 'wizard' | 'planning' | 'reader'

function App() {
  const [page, setPage] = useState<Page>('home')
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 检查URL参数恢复状态
    const params = new URLSearchParams(window.location.search)
    const projectId = params.get('project')
    if (projectId) {
      loadProject(projectId)
    }
  }, [])

  async function loadProject(id: string) {
    setLoading(true)
    setError(null)
    try {
      const project = await api.getProject(id)
      setCurrentProject(project)
      if (project.status === 'draft') {
        setPage('wizard')
      } else if (project.status === 'planning') {
        setPage('planning')
      } else {
        setPage('reader')
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function navigateTo(newPage: Page, project?: Project) {
    if (project) {
      setCurrentProject(project)
      window.history.pushState({}, '', `?project=${project.id}`)
    }
    setPage(newPage)
    setError(null)
  }

  function goHome() {
    setCurrentProject(null)
    window.history.pushState({}, '', '/')
    setPage('home')
    setError(null)
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="logo" onClick={goHome} style={{ cursor: 'pointer' }}>
            📚 课本工坊
          </h1>
          <nav className="header-nav">
            <button
              className={page === 'home' ? 'active' : ''}
              onClick={() => navigateTo('home')}
            >
              首页
            </button>
            <button
              className={page === 'projects' ? 'active' : ''}
              onClick={() => navigateTo('projects')}
            >
              我的教材
            </button>
            {currentProject && (
              <span className="current-project">
                {currentProject.name}
              </span>
            )}
          </nav>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>关闭</button>
        </div>
      )}

      <main className="app-main">
        {page === 'home' && <HomePage onStart={() => navigateTo('wizard')} />}
        {page === 'projects' && (
          <ProjectsPage
            onSelectProject={(p) => loadProject(p.id)}
            onCreateNew={() => navigateTo('wizard')}
          />
        )}
        {page === 'wizard' && (
          <WizardPage
            project={currentProject}
            onComplete={(p) => {
              setCurrentProject(p)
              navigateTo('planning', p)
            }}
            onBack={goHome}
          />
        )}
        {page === 'planning' && currentProject && (
          <PlanningPage
            project={currentProject}
            onStartGenerate={(p) => {
              setCurrentProject(p)
              navigateTo('reader', p)
            }}
            onBack={() => navigateTo('wizard', currentProject)}
          />
        )}
        {page === 'reader' && currentProject && (
          <ReaderPage project={currentProject} />
        )}
      </main>

      <footer className="app-footer">
        <p>2026 Qoder 高校创造力大赛 · StudyHack 赛道</p>
      </footer>
    </div>
  )
}

export default App
