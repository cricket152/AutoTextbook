import { useState } from 'react'
import './App.css'

function App() {
  const [topic, setTopic] = useState('')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')

  const handleGenerate = () => {
    if (!topic || !grade || !subject) {
      alert('请填写完整信息')
      return
    }
    console.log('生成教材:', { topic, grade, subject })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>AutoTextbook</h1>
        <p className="subtitle">AI自动教材生成工具</p>
      </header>

      <main className="app-main">
        <div className="form-container">
          <h2>生成教材</h2>
          
          <div className="form-group">
            <label htmlFor="subject">学科</label>
            <select 
              id="subject" 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">请选择学科</option>
              <option value="math">数学</option>
              <option value="chinese">语文</option>
              <option value="english">英语</option>
              <option value="physics">物理</option>
              <option value="chemistry">化学</option>
              <option value="biology">生物</option>
              <option value="history">历史</option>
              <option value="geography">地理</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="grade">学段</label>
            <select 
              id="grade" 
              value={grade} 
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">请选择学段</option>
              <option value="elementary">小学</option>
              <option value="middle">初中</option>
              <option value="high">高中</option>
              <option value="university">大学</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="topic">主题/章节</label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：二次函数、唐诗鉴赏、牛顿运动定律..."
            />
          </div>

          <button className="generate-btn" onClick={handleGenerate}>
            生成教材
          </button>
        </div>
      </main>

      <footer className="app-footer">
        <p>2026 Qoder 高校创造力大赛参赛作品</p>
      </footer>
    </div>
  )
}

export default App
