// 课本工坊后端路由
export function createApplication({ db, storage, requireUser, BackendError }) {
  const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
  const fail = (code, status) => { throw new BackendError(code, status); };
  const rows = result => {
    if (result.error) fail(result.error.code || 'database_error', result.error.status || 503);
    return result.data;
  };

  async function input(request) {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.startsWith('application/json')) fail('invalid_input', 400);
    const reader = request.body?.getReader();
    if (!reader) fail('invalid_input', 400);
    let size = 0;
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1024 * 1024) { // 1MB limit
          await reader.cancel();
          fail('payload_too_large', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      fail('invalid_input', 400);
    }
  }

  // 验证项目所有权
  async function ownedProject(projectId, user) {
    const found = rows(await db.from('projects')
      .select('id,owner_id,status')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .limit(1));
    if (!found?.length) fail('not_found', 404);
    return found[0];
  }

  return async ctx => {
    const request = ctx.request;
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/);
    if (!match) fail('not_found', 404);
    const path = match[1] || '/';

    // 公开健康检查
    if (path === '/api/health' && request.method === 'GET') {
      return Response.json({ ok: true, service: 'textbook-workshop' });
    }

    // 需要认证的路由
    const user = requireUser(ctx);

    // 获取当前用户
    if (path === '/api/me' && request.method === 'GET') {
      return Response.json({ id: user.id });
    }

    // ===== 项目管理 =====

    // 列出项目
    if (path === '/api/projects' && request.method === 'GET') {
      const projects = rows(await db.from('projects')
        .select('id,name,subject,grade_level,status,created_at,updated_at')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50));
      return Response.json(projects);
    }

    // 创建项目
    if (path === '/api/projects' && request.method === 'POST') {
      const body = await input(request);
      if (!body?.name || typeof body.name !== 'string' || body.name.length > 200) {
        fail('invalid_input', 400);
      }
      const id = crypto.randomUUID();
      const inserted = rows(await db.from('projects').insert({
        id,
        owner_id: user.id,
        name: body.name.trim(),
        subject: body.subject || null,
        grade_level: body.grade_level || null,
        learning_goals: body.learning_goals || null,
        status: 'draft'
      }).select('id,name,subject,grade_level,status,created_at').single());
      return Response.json(inserted, { status: 201 });
    }

    // 获取单个项目
    const projectMatch = path.match(/^\/api\/projects\/([0-9a-f-]{36})$/);
    if (projectMatch && uuid(projectMatch[1]) && request.method === 'GET') {
      const project = await ownedProject(projectMatch[1], user);
      return Response.json(project);
    }

    // 更新项目
    if (projectMatch && uuid(projectMatch[1]) && request.method === 'PATCH') {
      const body = await input(request);
      await ownedProject(projectMatch[1], user);
      const updates = {};
      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.length > 200) fail('invalid_input', 400);
        updates.name = body.name.trim();
      }
      if (body.subject !== undefined) updates.subject = body.subject;
      if (body.grade_level !== undefined) updates.grade_level = body.grade_level;
      if (body.learning_goals !== undefined) updates.learning_goals = body.learning_goals;
      if (body.status !== undefined) updates.status = body.status;
      updates.updated_at = new Date().toISOString();

      const updated = rows(await db.from('projects')
        .update(updates)
        .eq('id', projectMatch[1])
        .eq('owner_id', user.id)
        .select('id,name,subject,grade_level,status,updated_at')
        .maybeSingle());
      if (!updated) fail('not_found', 404);
      return Response.json(updated);
    }

    // 删除项目
    if (projectMatch && uuid(projectMatch[1]) && request.method === 'DELETE') {
      await ownedProject(projectMatch[1], user);
      rows(await db.from('projects')
        .delete()
        .eq('id', projectMatch[1])
        .eq('owner_id', user.id));
      return Response.json({ ok: true });
    }

    // ===== 来源材料管理 =====

    // 列出项目的来源
    const sourcesMatch = path.match(/^\/api\/projects\/([0-9a-f-]{36})\/sources$/);
    if (sourcesMatch && uuid(sourcesMatch[1]) && request.method === 'GET') {
      await ownedProject(sourcesMatch[1], user);
      const sources = rows(await db.from('sources')
        .select('id,filename,content_type,page_count,extraction_status,created_at')
        .eq('project_id', sourcesMatch[1])
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }));
      return Response.json(sources);
    }

    // 上传来源（创建待上传记录）
    if (sourcesMatch && uuid(sourcesMatch[1]) && request.method === 'POST') {
      await ownedProject(sourcesMatch[1], user);
      const body = await input(request);
      if (!body?.filename || !body?.content_type) fail('invalid_input', 400);

      const allowedTypes = ['application/pdf', 'text/markdown', 'text/plain'];
      if (!allowedTypes.includes(body.content_type)) fail('invalid_file_type', 400);

      const id = crypto.randomUUID();
      const objectPath = `sources/${sourcesMatch[1]}/${id}/${body.filename}`;

      rows(await db.from('sources').insert({
        id,
        project_id: sourcesMatch[1],
        owner_id: user.id,
        filename: body.filename,
        content_type: body.content_type,
        object_path: objectPath,
        extraction_status: 'pending'
      }));

      const signed = await storage.createSignedUploadUrl(objectPath, { upsert: false });
      return Response.json({ id, objectPath, ...signed }, { status: 201 });
    }

    // 完成上传验证
    const sourceCompleteMatch = path.match(/^\/api\/sources\/([0-9a-f-]{36})\/complete$/);
    if (sourceCompleteMatch && uuid(sourceCompleteMatch[1]) && request.method === 'POST') {
      const source = rows(await db.from('sources')
        .select('id,project_id,object_path,status')
        .eq('id', sourceCompleteMatch[1])
        .eq('owner_id', user.id)
        .limit(1));
      if (!source?.length) fail('not_found', 404);

      // 验证文件已上传
      try {
        const uploaded = await storage.download(source[0].object_path);
        if (!uploaded.ok) fail('upload_pending', 409);
        await uploaded.body?.cancel();
      } catch {
        fail('upload_pending', 409);
      }

      rows(await db.from('sources')
        .update({ extraction_status: 'processing' })
        .eq('id', sourceCompleteMatch[1])
        .eq('owner_id', user.id));

      return Response.json({ id: source[0].id, status: 'processing' });
    }

    // 下载来源
    const sourceDownloadMatch = path.match(/^\/api\/sources\/([0-9a-f-]{36})\/download$/);
    if (sourceDownloadMatch && uuid(sourceDownloadMatch[1]) && request.method === 'GET') {
      const source = rows(await db.from('sources')
        .select('id,object_path,extraction_status')
        .eq('id', sourceDownloadMatch[1])
        .eq('owner_id', user.id)
        .limit(1));
      if (!source?.length) fail('not_found', 404);
      if (source[0].extraction_status !== 'completed') fail('source_not_ready', 409);

      const signed = await storage.createSignedUrl(source[0].object_path, 300);
      return Response.json(signed);
    }

    // ===== 大纲管理 =====

    // 获取项目大纲
    const outlineMatch = path.match(/^\/api\/projects\/([0-9a-f-]{36})\/outline$/);
    if (outlineMatch && uuid(outlineMatch[1]) && request.method === 'GET') {
      await ownedProject(outlineMatch[1], user);
      const outline = rows(await db.from('outlines')
        .select('id,version,structure,status,created_at')
        .eq('project_id', outlineMatch[1])
        .order('version', { ascending: false })
        .limit(1));
      return Response.json(outline[0] || null);
    }

    // 保存/更新大纲
    if (outlineMatch && uuid(outlineMatch[1]) && request.method === 'POST') {
      await ownedProject(outlineMatch[1], user);
      const body = await input(request);
      if (!body?.structure || typeof body.structure !== 'object') fail('invalid_input', 400);

      // 获取当前版本
      const current = rows(await db.from('outlines')
        .select('version')
        .eq('project_id', outlineMatch[1])
        .order('version', { ascending: false })
        .limit(1));
      const newVersion = (current[0]?.version || 0) + 1;

      const id = crypto.randomUUID();
      const inserted = rows(await db.from('outlines').insert({
        id,
        project_id: outlineMatch[1],
        version: newVersion,
        structure: body.structure,
        status: body.status || 'draft'
      }).select('id,version,structure,status,created_at').single());

      return Response.json(inserted, { status: 201 });
    }

    // ===== 教材版本 =====

    // 获取教材版本列表
    const revisionsMatch = path.match(/^\/api\/projects\/([0-9a-f-]{36})\/revisions$/);
    if (revisionsMatch && uuid(revisionsMatch[1]) && request.method === 'GET') {
      await ownedProject(revisionsMatch[1], user);
      const revisions = rows(await db.from('book_revisions')
        .select('id,version_number,summary,status,created_at')
        .eq('project_id', revisionsMatch[1])
        .order('version_number', { ascending: false }));
      return Response.json(revisions);
    }

    // 获取单个教材版本详情
    const revisionMatch = path.match(/^\/api\/revisions\/([0-9a-f-]{36})$/);
    if (revisionMatch && uuid(revisionMatch[1]) && request.method === 'GET') {
      const revision = rows(await db.from('book_revisions')
        .select('id,project_id,outline_id,version_number,content,summary,status,created_at')
        .eq('id', revisionMatch[1])
        .limit(1));
      if (!revision?.length) fail('not_found', 404);
      await ownedProject(revision[0].project_id, user);
      return Response.json(revision[0]);
    }

    // ===== 章节内容 =====

    // 获取教材版本的章节列表
    const sectionsMatch = path.match(/^\/api\/revisions\/([0-9a-f-]{36})\/sections$/);
    if (sectionsMatch && uuid(sectionsMatch[1]) && request.method === 'GET') {
      const revision = rows(await db.from('book_revisions')
        .select('id,project_id')
        .eq('id', sectionsMatch[1])
        .limit(1));
      if (!revision?.length) fail('not_found', 404);
      await ownedProject(revision[0].project_id, user);

      const sections = rows(await db.from('section_revisions')
        .select('id,section_id,title,version,created_at')
        .eq('book_revision_id', sectionsMatch[1])
        .order('created_at', { ascending: true }));
      return Response.json(sections);
    }

    // 获取单个章节内容
    const sectionMatch = path.match(/^\/api\/sections\/([0-9a-f-]{36})$/);
    if (sectionMatch && uuid(sectionMatch[1]) && request.method === 'GET') {
      const section = rows(await db.from('section_revisions')
        .select('id,book_revision_id,section_id,title,content,sources,figures,exercises,version,created_at')
        .eq('id', sectionMatch[1])
        .limit(1));
      if (!section?.length) fail('not_found', 404);

      const revision = rows(await db.from('book_revisions')
        .select('project_id')
        .eq('id', section[0].book_revision_id)
        .limit(1));
      await ownedProject(revision[0].project_id, user);

      return Response.json(section[0]);
    }

    // ===== 会话与Agent =====

    // 列出项目的会话
    const conversationsMatch = path.match(/^\/api\/projects\/([0-9a-f-]{36})\/conversations$/);
    if (conversationsMatch && uuid(conversationsMatch[1]) && request.method === 'GET') {
      await ownedProject(conversationsMatch[1], user);
      const conversations = rows(await db.from('conversations')
        .select('id,title,created_at,updated_at')
        .eq('project_id', conversationsMatch[1])
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false }));
      return Response.json(conversations);
    }

    // 创建会话
    if (conversationsMatch && uuid(conversationsMatch[1]) && request.method === 'POST') {
      await ownedProject(conversationsMatch[1], user);
      const body = await input(request);

      const id = crypto.randomUUID();
      const inserted = rows(await db.from('conversations').insert({
        id,
        project_id: conversationsMatch[1],
        owner_id: user.id,
        book_revision_id: body.book_revision_id || null,
        title: body.title || '新对话'
      }).select('id,title,created_at').single());

      return Response.json(inserted, { status: 201 });
    }

    // 获取会话消息
    const messagesMatch = path.match(/^\/api\/conversations\/([0-9a-f-]{36})\/messages$/);
    if (messagesMatch && uuid(messagesMatch[1]) && request.method === 'GET') {
      const conversation = rows(await db.from('conversations')
        .select('id,project_id,owner_id')
        .eq('id', messagesMatch[1])
        .limit(1));
      if (!conversation?.length) fail('not_found', 404);
      if (conversation[0].owner_id !== user.id) fail('not_found', 404);

      const messages = rows(await db.from('messages')
        .select('id,role,content,sources,patch_proposal,created_at')
        .eq('conversation_id', messagesMatch[1])
        .order('created_at', { ascending: true })
        .limit(100));
      return Response.json(messages);
    }

    // 发送消息
    if (messagesMatch && uuid(messagesMatch[1]) && request.method === 'POST') {
      const conversation = rows(await db.from('conversations')
        .select('id,project_id,owner_id,book_revision_id')
        .eq('id', messagesMatch[1])
        .limit(1));
      if (!conversation?.length) fail('not_found', 404);
      if (conversation[0].owner_id !== user.id) fail('not_found', 404);

      const body = await input(request);
      if (!body?.content || typeof body.content !== 'string') fail('invalid_input', 400);

      // 保存用户消息
      const userMsgId = crypto.randomUUID();
      rows(await db.from('messages').insert({
        id: userMsgId,
        conversation_id: messagesMatch[1],
        role: 'user',
        content: body.content
      }));

      // 更新会话时间
      rows(await db.from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', messagesMatch[1]));

      // TODO: 调用AI Agent生成回复
      // 这里暂时返回一个模拟回复
      const assistantMsgId = crypto.randomUUID();
      const assistantContent = generateMockResponse(body.content, conversation[0].book_revision_id);

      rows(await db.from('messages').insert({
        id: assistantMsgId,
        conversation_id: messagesMatch[1],
        role: 'assistant',
        content: assistantContent,
        sources: null,
        patch_proposal: null
      }));

      return Response.json({
        userMessage: { id: userMsgId, role: 'user', content: body.content },
        assistantMessage: { id: assistantMsgId, role: 'assistant', content: assistantContent }
      }, { status: 201 });
    }

    // ===== 任务管理 =====

    // 列出项目的任务
    const jobsMatch = path.match(/^\/api\/projects\/([0-9a-f-]{36})\/jobs$/);
    if (jobsMatch && uuid(jobsMatch[1]) && request.method === 'GET') {
      await ownedProject(jobsMatch[1], user);
      const jobs = rows(await db.from('jobs')
        .select('id,job_type,status,stage,progress,error,created_at,completed_at')
        .eq('project_id', jobsMatch[1])
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20));
      return Response.json(jobs);
    }

    // 创建任务
    if (jobsMatch && uuid(jobsMatch[1]) && request.method === 'POST') {
      await ownedProject(jobsMatch[1], user);
      const body = await input(request);
      if (!body?.job_type) fail('invalid_input', 400);

      const validTypes = ['extract_sources', 'generate_outline', 'generate_textbook', 'export_markdown', 'export_pdf'];
      if (!validTypes.includes(body.job_type)) fail('invalid_job_type', 400);

      const id = crypto.randomUUID();
      const inserted = rows(await db.from('jobs').insert({
        id,
        project_id: jobsMatch[1],
        owner_id: user.id,
        job_type: body.job_type,
        status: 'pending',
        progress: body.params || {}
      }).select('id,job_type,status,created_at').single());

      // TODO: 触发异步任务处理

      return Response.json(inserted, { status: 201 });
    }

    // 获取任务状态
    const jobMatch = path.match(/^\/api\/jobs\/([0-9a-f-]{36})$/);
    if (jobMatch && uuid(jobMatch[1]) && request.method === 'GET') {
      const job = rows(await db.from('jobs')
        .select('id,project_id,job_type,status,stage,progress,result,error,retry_count,started_at,completed_at,created_at')
        .eq('id', jobMatch[1])
        .eq('owner_id', user.id)
        .limit(1));
      if (!job?.length) fail('not_found', 404);
      return Response.json(job[0]);
    }

    // 取消任务
    if (jobMatch && uuid(jobMatch[1]) && request.method === 'POST') {
      const job = rows(await db.from('jobs')
        .select('id,status')
        .eq('id', jobMatch[1])
        .eq('owner_id', user.id)
        .limit(1));
      if (!job?.length) fail('not_found', 404);
      if (!['pending', 'running'].includes(job[0].status)) fail('job_not_cancellable', 409);

      rows(await db.from('jobs')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', jobMatch[1]));

      return Response.json({ ok: true });
    }

    // ===== 导出 =====

    // 请求导出
    const exportMatch = path.match(/^\/api\/revisions\/([0-9a-f-]{36})\/export$/);
    if (exportMatch && uuid(exportMatch[1]) && request.method === 'POST') {
      const revision = rows(await db.from('book_revisions')
        .select('id,project_id')
        .eq('id', exportMatch[1])
        .limit(1));
      if (!revision?.length) fail('not_found', 404);
      await ownedProject(revision[0].project_id, user);

      const body = await input(request);
      if (!['markdown', 'pdf'].includes(body?.format)) fail('invalid_export_format', 400);

      const id = crypto.randomUUID();
      const objectPath = `exports/${revision[0].project_id}/${id}.${body.format === 'markdown' ? 'md' : 'pdf'}`;

      rows(await db.from('exports').insert({
        id,
        project_id: revision[0].project_id,
        book_revision_id: exportMatch[1],
        export_type: body.format,
        object_path: objectPath,
        status: 'pending'
      }));

      // TODO: 触发导出任务

      return Response.json({ id, format: body.format, status: 'pending' }, { status: 201 });
    }

    // 下载导出文件
    const exportDownloadMatch = path.match(/^\/api\/exports\/([0-9a-f-]{36})\/download$/);
    if (exportDownloadMatch && uuid(exportDownloadMatch[1]) && request.method === 'GET') {
      const exp = rows(await db.from('exports')
        .select('id,project_id,object_path,status')
        .eq('id', exportDownloadMatch[1])
        .limit(1));
      if (!exp?.length) fail('not_found', 404);
      await ownedProject(exp[0].project_id, user);
      if (exp[0].status !== 'ready') fail('export_not_ready', 409);

      const signed = await storage.createSignedUrl(exp[0].object_path, 300);
      return Response.json(signed);
    }

    // ===== 修改提案 =====

    // 获取项目的修改提案
    const patchesMatch = path.match(/^\/api\/projects\/([0-9a-f-]{36})\/patches$/);
    if (patchesMatch && uuid(patchesMatch[1]) && request.method === 'GET') {
      await ownedProject(patchesMatch[1], user);
      const patches = rows(await db.from('patch_proposals')
        .select('id,section_id,reason,status,created_at')
        .eq('project_id', patchesMatch[1])
        .order('created_at', { ascending: false })
        .limit(50));
      return Response.json(patches);
    }

    // 应用修改提案
    const patchApplyMatch = path.match(/^\/api\/patches\/([0-9a-f-]{36})\/apply$/);
    if (patchApplyMatch && uuid(patchApplyMatch[1]) && request.method === 'POST') {
      const patch = rows(await db.from('patch_proposals')
        .select('id,project_id,book_revision_id,section_id,new_content,status')
        .eq('id', patchApplyMatch[1])
        .limit(1));
      if (!patch?.length) fail('not_found', 404);
      await ownedProject(patch[0].project_id, user);
      if (patch[0].status !== 'pending') fail('patch_not_pending', 409);

      // 创建新的章节修订
      const newSectionId = crypto.randomUUID();
      rows(await db.from('section_revisions').insert({
        id: newSectionId,
        book_revision_id: patch[0].book_revision_id,
        section_id: patch[0].section_id,
        title: '', // 从原章节获取
        content: patch[0].new_content,
        version: 1
      }));

      // 更新提案状态
      rows(await db.from('patch_proposals')
        .update({ status: 'applied', applied_at: new Date().toISOString() })
        .eq('id', patchApplyMatch[1]));

      return Response.json({ ok: true, new_section_id: newSectionId });
    }

    // 拒绝修改提案
    const patchRejectMatch = path.match(/^\/api\/patches\/([0-9a-f-]{36})\/reject$/);
    if (patchRejectMatch && uuid(patchRejectMatch[1]) && request.method === 'POST') {
      const patch = rows(await db.from('patch_proposals')
        .select('id,project_id,status')
        .eq('id', patchRejectMatch[1])
        .limit(1));
      if (!patch?.length) fail('not_found', 404);
      await ownedProject(patch[0].project_id, user);
      if (patch[0].status !== 'pending') fail('patch_not_pending', 409);

      rows(await db.from('patch_proposals')
        .update({ status: 'rejected' })
        .eq('id', patchRejectMatch[1]));

      return Response.json({ ok: true });
    }

    fail('not_found', 404);
  };
}

// 模拟AI回复（实际应调用AI服务）
function generateMockResponse(userMessage, bookRevisionId) {
  const lowerMsg = userMessage.toLowerCase();

  if (lowerMsg.includes('解释') || lowerMsg.includes('什么意思')) {
    return '这个概念在教材中有详细说明。简单来说，它是计算机科学中的一个基础概念，用于描述...（此处为示例回复，实际将调用AI生成）';
  }

  if (lowerMsg.includes('例子') || lowerMsg.includes('示例')) {
    return '好的，让我举一个例子来说明：\n\n假设我们有一个简单的场景...\n\n这个例子展示了概念的实际应用。';
  }

  if (lowerMsg.includes('看不懂') || lowerMsg.includes('不理解')) {
    return '我理解这部分可能有些困难。让我从另一个角度解释：\n\n1. 首先，核心思想是...\n2. 然后，我们可以...\n3. 最后，结果是...\n\n如果还有疑问，请告诉我具体哪里不清楚。';
  }

  if (lowerMsg.includes('修改') || lowerMsg.includes('改一下')) {
    return '我可以帮您修改这部分内容。请告诉我：\n1. 您希望修改哪个章节？\n2. 具体想要改什么？\n3. 修改的原因是什么？\n\n我会生成一个修改提案供您审核。';
  }

  return '我是您的教材助手，可以帮您：\n- 解释教材中的概念\n- 提供额外的例子\n- 回答相关问题\n- 协助修改教材内容\n\n请问有什么我可以帮助您的？';
}
