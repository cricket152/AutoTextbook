# 课本工坊 - 项目状态

## 已发布站点

**公开访问地址**: https://textbook-workshop-5snbi4trrc9.qoder.zone

## 项目概述

课本工坊是一个 AI 驱动的自动教材生成工具，面向需要从零散课件整理出系统教材的大学生和自学者。

### 核心功能

1. **资料上传**：支持 PDF 和 Markdown 格式的学习资料上传
2. **智能规划**：AI 分析资料并生成教材大纲
3. **教材生成**：按章节生成完整教材内容，包含图解、实例和练习
4. **专属助手**：每本教材配备 AI 助手，支持答疑和修改建议
5. **版本管理**：记录每次修改，支持历史版本回看
6. **导出下载**：支持 Markdown 和 PDF 格式导出

## 技术架构

### 前端
- React 18 + TypeScript
- Vite 构建工具
- 响应式设计，支持桌面和移动端

### 后端
- Qoder Sites Edge Functions (Deno)
- Supabase 数据库（function_backend 模式）
- 平台 Storage 文件存储

### 数据库表结构
- `projects` - 教材项目
- `sources` - 上传的来源材料
- `outlines` - 教材大纲
- `book_revisions` - 教材版本
- `section_revisions` - 章节内容
- `conversations` - 用户会话
- `messages` - 对话消息
- `jobs` - 异步任务
- `exports` - 导出记录

## 当前状态

### 已完成
- [x] GitHub 仓库创建和初始化
- [x] 前端完整界面（首页、项目管理、向导、规划、阅读器）
- [x] 后端 API 路由（项目、来源、大纲、教材、会话、任务、导出）
- [x] 数据库 schema 创建和迁移
- [x] Qoder Sites 部署和发布
- [x] 基础 UI 样式和交互

### 待完成
- [ ] AI 模型集成（需要配置 QODER_PAT 或外部 LLM API）
- [ ] 真实的教材生成 workflow（当前为模拟）
- [ ] PDF 导出功能（需要集成 PDF 生成库）
- [ ] 文件内容提取（PDF 文本提取）
- [ ] 示例教材数据
- [ ] 完整的端到端测试

## 配置需求

### 必需配置

1. **AI 服务**：当前后端使用模拟回复。要启用真实 AI 功能，需要：
   - 配置 Qoder Cloud Agents（推荐）：在 Sites Settings 中设置 QODER_PAT
   - 或配置外部 LLM API：设置 LLM_API_KEY、LLM_BASE_URL、LLM_MODEL 等环境变量

2. **数据库**：已配置完成，等待平台同步

### 可选配置

- 文件上传大小限制
- 并发任务限制
- 导出格式选项

## 开发说明

### 本地开发

```bash
# 安装依赖
npm install

# 启动前端开发服务器
npm run dev

# 启动本地后端（需要 Deno）
npm run dev:function

# 构建生产版本
npm run build
```

### 项目结构

```
AutoTextbook/
├── src/                    # 前端源码
│   ├── App.tsx            # 主应用组件
│   ├── App.css            # 全局样式
│   ├── lib/
│   │   └── api.ts         # API 客户端
│   └── pages/
│       ├── HomePage.tsx       # 首页
│       ├── ProjectsPage.tsx   # 项目列表
│       ├── WizardPage.tsx     # 创建向导
│       ├── PlanningPage.tsx   # 大纲规划
│       └── ReaderPage.tsx     # 教材阅读器
├── functions/              # 后端函数
│   ├── index.ts           # 入口
│   └── routes.mjs         # 路由处理
├── dev/                    # 本地开发工具
│   ├── server.mjs         # 本地服务器
│   ├── auth.mjs           # 认证模拟
│   ├── database.mjs       # 数据库模拟
│   └── storage.mjs        # 存储模拟
├── dist/                   # 构建输出
├── schema.sql              # 数据库 schema
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 参赛信息

- **比赛**: 2026 Qoder 高校创造力大赛
- **赛道**: StudyHack 学习科研赛道
- **团队**: cricket152
- **作品名**: 课本工坊

## 后续计划

1. 配置 AI 服务，实现真实的教材生成
2. 完善文件上传和内容提取
3. 添加 PDF 导出功能
4. 创建示例教材供用户体验
5. 进行完整的端到端测试
6. 准备比赛提交材料

---

*最后更新: 2026-11-07*
