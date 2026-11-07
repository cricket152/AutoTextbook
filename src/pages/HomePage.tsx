interface Props {
  onStart: () => void
}

export default function HomePage({ onStart }: Props) {
  return (
    <div className="home-page">
      <section className="hero">
        <h1>把零散课件变成系统教材</h1>
        <p className="hero-subtitle">
          上传你的学习资料，AI 帮你整理成有逻辑、有图解、有练习的个人教材
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-large" onClick={onStart}>
            开始创建教材
          </button>
          <a href="#example" className="btn btn-secondary btn-large">
            查看示例
          </a>
        </div>
      </section>

      <section className="features">
        <h2>核心功能</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📄</div>
            <h3>智能整理</h3>
            <p>自动分析你的 PDF 和 Markdown 资料，提取知识点，生成学习大纲</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📚</div>
            <h3>教材生成</h3>
            <p>按章节生成完整教材内容，包含图解、实例、练习和来源引用</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>专属助手</h3>
            <p>每本教材配备 AI 助手，边读边问，解释概念，回答疑问</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✏️</div>
            <h3>可修改</h3>
            <p>对教材内容不满意？提出修改意见，AI 生成修订建议供你审核</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>版本管理</h3>
            <p>每次修改都有记录，可以随时回看历史版本，对比差异</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⬇️</div>
            <h3>导出下载</h3>
            <p>支持导出为 Markdown 和 PDF 格式，方便离线阅读和打印</p>
          </div>
        </div>
      </section>

      <section className="workflow">
        <h2>使用流程</h2>
        <div className="workflow-steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>上传资料</h3>
            <p>上传课件 PDF、笔记 Markdown 或其他学习材料</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>设定目标</h3>
            <p>告诉 AI 你的学习目标和基础水平</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>确认大纲</h3>
            <p>查看 AI 生成的目录结构，按需调整</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>生成教材</h3>
            <p>AI 按章节生成完整教材内容</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">5</div>
            <h3>阅读学习</h3>
            <p>边读边问，随时修改，导出分享</p>
          </div>
        </div>
      </section>

      <section className="example" id="example">
        <h2>示例教材</h2>
        <div className="example-card">
          <div className="example-header">
            <h3>Python 编程入门</h3>
            <span className="status-badge status-completed">已完成</span>
          </div>
          <div className="example-meta">
            <span>学科: 计算机科学</span>
            <span>学段: 大学一年级</span>
            <span>章节: 8 章</span>
          </div>
          <div className="example-outline">
            <h4>目录预览</h4>
            <ul>
              <li>第1章：编程基础概念</li>
              <li>第2章：变量与数据类型</li>
              <li>第3章：条件判断与循环</li>
              <li>第4章：函数定义与调用</li>
              <li>...</li>
            </ul>
          </div>
          <button className="btn btn-secondary" onClick={onStart}>
            基于此模板创建
          </button>
        </div>
      </section>

      <style>{`
        .home-page {
          max-width: 1200px;
          margin: 0 auto;
        }
        .hero {
          text-align: center;
          padding: 4rem 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: var(--radius);
          margin-bottom: 3rem;
        }
        .hero h1 {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }
        .hero-subtitle {
          font-size: 1.2rem;
          opacity: 0.9;
          margin-bottom: 2rem;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }
        .hero-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }
        .btn-large {
          padding: 1rem 2rem;
          font-size: 1.1rem;
        }
        .features {
          margin-bottom: 3rem;
        }
        .features h2 {
          text-align: center;
          font-size: 2rem;
          margin-bottom: 2rem;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }
        .feature-card {
          background: var(--surface);
          padding: 2rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          text-align: center;
        }
        .feature-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .feature-card h3 {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .feature-card p {
          color: var(--text-secondary);
          line-height: 1.6;
        }
        .workflow {
          margin-bottom: 3rem;
        }
        .workflow h2 {
          text-align: center;
          font-size: 2rem;
          margin-bottom: 2rem;
        }
        .workflow-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .step {
          background: var(--surface);
          padding: 1.5rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          text-align: center;
          width: 180px;
        }
        .step-number {
          width: 40px;
          height: 40px;
          background: var(--primary);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          margin: 0 auto 1rem;
        }
        .step h3 {
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }
        .step p {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        .step-arrow {
          font-size: 1.5rem;
          color: var(--text-secondary);
        }
        .example {
          margin-bottom: 3rem;
        }
        .example h2 {
          text-align: center;
          font-size: 2rem;
          margin-bottom: 2rem;
        }
        .example-card {
          background: var(--surface);
          padding: 2rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          max-width: 600px;
          margin: 0 auto;
        }
        .example-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .example-meta {
          display: flex;
          gap: 1rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }
        .example-outline {
          background: var(--bg);
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1rem;
        }
        .example-outline h4 {
          margin-bottom: 0.5rem;
        }
        .example-outline ul {
          list-style: none;
          padding: 0;
        }
        .example-outline li {
          padding: 0.25rem 0;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  )
}
