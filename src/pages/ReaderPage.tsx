import { useState, useEffect, useRef } from 'react'
import { api, Project, Conversation, Message, errorMessage } from '../lib/api'

interface Props {
  project: Project
}

export default function ReaderPage({ project }: Props) {
  const [currentRevision, setCurrentRevision] = useState<any | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [selectedText, setSelectedText] = useState('')

  useEffect(() => {
    loadData()
  }, [project.id])

  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id)
    }
  }, [currentConversation])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadData() {
    setLoading(true)
    try {
      const [revisionsData, conversationsData] = await Promise.all([
        api.listRevisions(project.id),
        api.listConversations(project.id)
      ])
      setConversations(conversationsData)
      if (revisionsData.length > 0) {
        const latest = revisionsData[0]
        const fullRevision = await api.getRevision(latest.id)
        setCurrentRevision(fullRevision)
      }
      if (conversationsData.length > 0) {
        setCurrentConversation(conversationsData[0])
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const msgs = await api.getMessages(conversationId)
      setMessages(msgs)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  async function createNewConversation() {
    try {
      const conv = await api.createConversation(project.id, {
        title: '新对话',
        book_revision_id: currentRevision?.id
      })
      setConversations([conv, ...conversations])
      setCurrentConversation(conv)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || !currentConversation || sending) return

    const content = inputMessage.trim()
    setInputMessage('')
    setSending(true)

    // 添加用户消息到界面
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString()
    }
    setMessages([...messages, userMsg])

    try {
      const result = await api.sendMessage(currentConversation.id, content)
      setMessages(prev => [...prev.filter(m => m.id !== userMsg.id), result.userMessage, result.assistantMessage])
    } catch (err) {
      setError(errorMessage(err))
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
      setInputMessage(content)
    } finally {
      setSending(false)
    }
  }

  function handleTextSelection() {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim())
    }
  }

  async function askAboutSelection() {
    if (!selectedText || !currentConversation) return
    setInputMessage(`请解释这段内容：「${selectedText}」`)
    setSelectedText('')
  }

  async function proposeModification() {
    if (!selectedText || !currentConversation) return
    const newContent = prompt('请输入修改后的内容：')
    if (newContent) {
      setInputMessage(`请修改这段内容：「${selectedText}」改为「${newContent}」`)
      setSelectedText('')
    }
  }

  async function exportAs(format: 'markdown' | 'pdf') {
    if (!currentRevision) return
    try {
      const result = await api.requestExport(currentRevision.id, format)
      alert(`导出请求已提交，任务ID: ${result.id}`)
      // TODO: 轮询导出状态并提供下载
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (loading) {
    return <div className="reader-loading">加载中...</div>
  }

  if (!currentRevision) {
    return (
      <div className="reader-empty">
        <h2>教材尚未生成</h2>
        <p>请先完成规划并开始生成教材</p>
      </div>
    )
  }

  // 模拟教材内容（实际应从 revision.content 获取）
  const textbookContent = currentRevision.content || {
    chapters: [
      {
        id: 'ch1',
        title: '第一章 编程基础',
        sections: [
          {
            id: 'sec1-1',
            title: '1.1 什么是编程',
            content: `# 1.1 什么是编程

编程是人与计算机沟通的方式。通过编写代码，我们可以告诉计算机要做什么。

## 核心概念

**程序**是一系列指令的集合，计算机按照这些指令执行任务。

**算法**是解决问题的步骤和方法。

## 示例

让我们看一个简单的 Python 程序：

\`\`\`python
print("Hello, World!")
\`\`\`

这个程序会在屏幕上输出 "Hello, World!"。

## 练习

1. 尝试修改上面的程序，让它输出你的名字
2. 思考：日常生活中有哪些事情可以用"程序"来描述？`
          }
        ]
      }
    ]
  }

  return (
    <div className="reader-page">
      {error && <div className="error-toast">{error}<button onClick={() => setError(null)}>×</button></div>}

      {/* 顶部工具栏 */}
      <div className="reader-toolbar">
        <div className="toolbar-left">
          <button
            className="btn-icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? '收起目录' : '展开目录'}
          >
            ☰
          </button>
          <h3 className="project-title">{project.name}</h3>
          <span className="version-badge">v{currentRevision.version_number}</span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-secondary btn-small" onClick={() => exportAs('markdown')}>
            导出 Markdown
          </button>
          <button className="btn btn-secondary btn-small" onClick={() => exportAs('pdf')}>
            导出 PDF
          </button>
          <button
            className="btn-icon"
            onClick={() => setChatOpen(!chatOpen)}
            title={chatOpen ? '收起助手' : '展开助手'}
          >
            💬
          </button>
        </div>
      </div>

      <div className="reader-content">
        {/* 左侧目录 */}
        {sidebarOpen && (
          <aside className="reader-sidebar">
            <h4>目录</h4>
            <nav className="toc">
              {textbookContent.chapters?.map((chapter: any) => (
                <div key={chapter.id} className="toc-chapter">
                  <div className="toc-chapter-title">{chapter.title}</div>
                  <ul className="toc-sections">
                    {chapter.sections?.map((section: any) => (
                      <li key={section.id} className="toc-section">
                        <a href={`#${section.id}`}>{section.title}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        )}

        {/* 中间教材内容 */}
        <main
          className="reader-main"
          onMouseUp={handleTextSelection}
        >
          {textbookContent.chapters?.map((chapter: any) => (
            <div key={chapter.id} className="chapter-content">
              {chapter.sections?.map((section: any) => (
                <section key={section.id} id={section.id} className="section-content">
                  <div className="markdown-content" dangerouslySetInnerHTML={{ __html: section.content }} />
                </section>
              ))}
            </div>
          ))}
        </main>

        {/* 右侧AI助手 */}
        {chatOpen && (
          <aside className="reader-chat">
            <div className="chat-header">
              <h4>教材助手</h4>
              <select
                value={currentConversation?.id || ''}
                onChange={(e) => {
                  const conv = conversations.find(c => c.id === e.target.value)
                  if (conv) setCurrentConversation(conv)
                }}
              >
                {conversations.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <button className="btn-icon" onClick={createNewConversation} title="新建对话">
                +
              </button>
            </div>

            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-empty">
                  <p>👋 你好！我是你的教材助手。</p>
                  <p>你可以：</p>
                  <ul>
                    <li>选中教材中的文字，问我"这是什么意思"</li>
                    <li>让我举例说明某个概念</li>
                    <li>要求我修改教材内容</li>
                  </ul>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.role}`}>
                  <div className="message-content">{msg.content}</div>
                  {msg.sources && (
                    <div className="message-sources">
                      <small>来源: {JSON.stringify(msg.sources)}</small>
                    </div>
                  )}
                  {msg.patch_proposal && (
                    <div className="message-patch">
                      <small>修改提案已生成</small>
                      <button className="btn btn-small btn-primary">查看修改</button>
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="chat-message assistant typing">
                  <div className="message-content">正在思考...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {selectedText && (
              <div className="selection-actions">
                <p className="selection-preview">「{selectedText.slice(0, 50)}...」</p>
                <button className="btn btn-small btn-secondary" onClick={askAboutSelection}>
                  解释这段
                </button>
                <button className="btn btn-small btn-primary" onClick={proposeModification}>
                  修改这段
                </button>
                <button className="btn-icon" onClick={() => setSelectedText('')}>×</button>
              </div>
            )}

            <div className="chat-input">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="输入问题或修改建议..."
                rows={3}
                disabled={!currentConversation || sending}
              />
              <button
                className="btn btn-primary"
                onClick={sendMessage}
                disabled={!inputMessage.trim() || !currentConversation || sending}
              >
                发送
              </button>
            </div>
          </aside>
        )}
      </div>

      <style>{`
        .reader-page {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 140px);
          max-width: 100%;
        }
        .reader-loading, .reader-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          color: var(--text-secondary);
        }
        .error-toast {
          position: fixed;
          top: 1rem;
          right: 1rem;
          background: var(--error);
          color: white;
          padding: 1rem;
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          gap: 1rem;
          z-index: 1000;
        }
        .error-toast button {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
        }
        .reader-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .toolbar-left, .toolbar-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .project-title {
          font-size: 1.1rem;
          margin: 0;
        }
        .version-badge {
          background: var(--bg);
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .btn-small {
          padding: 0.5rem 0.75rem;
          font-size: 0.85rem;
        }
        .reader-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .reader-sidebar {
          width: 250px;
          background: var(--surface);
          border-right: 1px solid var(--border);
          overflow-y: auto;
          padding: 1rem;
        }
        .reader-sidebar h4 {
          margin-bottom: 1rem;
          color: var(--text-secondary);
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .toc-chapter {
          margin-bottom: 1rem;
        }
        .toc-chapter-title {
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text);
        }
        .toc-sections {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .toc-section {
          margin-bottom: 0.25rem;
        }
        .toc-section a {
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.9rem;
          display: block;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius);
          transition: all 0.2s;
        }
        .toc-section a:hover {
          background: var(--bg);
          color: var(--primary);
        }
        .reader-main {
          flex: 1;
          overflow-y: auto;
          padding: 2rem 3rem;
          background: var(--bg);
        }
        .chapter-content {
          max-width: 800px;
          margin: 0 auto 3rem;
        }
        .section-content {
          background: var(--surface);
          padding: 2rem;
          border-radius: var(--radius);
          margin-bottom: 2rem;
          box-shadow: var(--shadow);
        }
        .markdown-content {
          line-height: 1.8;
        }
        .markdown-content h1 {
          font-size: 2rem;
          margin-bottom: 1rem;
          color: var(--text);
        }
        .markdown-content h2 {
          font-size: 1.5rem;
          margin: 2rem 0 1rem;
          color: var(--text);
        }
        .markdown-content h3 {
          font-size: 1.25rem;
          margin: 1.5rem 0 0.75rem;
        }
        .markdown-content p {
          margin-bottom: 1rem;
        }
        .markdown-content code {
          background: var(--bg);
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-size: 0.9em;
        }
        .markdown-content pre {
          background: #1e293b;
          color: #e2e8f0;
          padding: 1rem;
          border-radius: var(--radius);
          overflow-x: auto;
          margin: 1rem 0;
        }
        .markdown-content pre code {
          background: none;
          padding: 0;
          color: inherit;
        }
        .markdown-content ul, .markdown-content ol {
          margin: 1rem 0;
          padding-left: 2rem;
        }
        .markdown-content li {
          margin-bottom: 0.5rem;
        }
        .reader-chat {
          width: 350px;
          background: var(--surface);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
        }
        .chat-header {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .chat-header h4 {
          margin: 0;
          flex: 1;
        }
        .chat-header select {
          padding: 0.25rem 0.5rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          font-size: 0.85rem;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .chat-empty {
          text-align: center;
          color: var(--text-secondary);
          padding: 2rem 1rem;
        }
        .chat-empty ul {
          text-align: left;
          margin-top: 0.5rem;
          padding-left: 1.5rem;
        }
        .chat-message {
          padding: 0.75rem 1rem;
          border-radius: var(--radius);
          max-width: 90%;
        }
        .chat-message.user {
          background: var(--primary);
          color: white;
          align-self: flex-end;
        }
        .chat-message.assistant {
          background: var(--bg);
          align-self: flex-start;
        }
        .chat-message.typing {
          opacity: 0.7;
        }
        .message-sources, .message-patch {
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(0,0,0,0.1);
        }
        .message-patch {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .selection-actions {
          padding: 0.75rem;
          background: #eff6ff;
          border-top: 1px solid #bfdbfe;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .selection-preview {
          flex: 1;
          font-size: 0.85rem;
          color: #1e40af;
          margin: 0;
          min-width: 100%;
        }
        .chat-input {
          padding: 1rem;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .chat-input textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          resize: none;
          font-family: inherit;
          font-size: 0.9rem;
        }
        .chat-input textarea:focus {
          outline: none;
          border-color: var(--primary);
        }
        .chat-input button {
          align-self: flex-end;
        }
        @media (max-width: 1024px) {
          .reader-sidebar {
            width: 200px;
          }
          .reader-chat {
            width: 300px;
          }
          .reader-main {
            padding: 1.5rem;
          }
        }
        @media (max-width: 768px) {
          .reader-content {
            flex-direction: column;
          }
          .reader-sidebar, .reader-chat {
            width: 100%;
            max-height: 40vh;
          }
          .reader-main {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  )
}
