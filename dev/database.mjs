// 本地开发用数据库模拟器
export function createDatabaseClient() {
  const data = {
    projects: [],
    sources: [],
    knowledge_points: [],
    outlines: [],
    book_revisions: [],
    section_revisions: [],
    figures: [],
    book_agent_profiles: [],
    conversations: [],
    messages: [],
    patch_proposals: [],
    jobs: [],
    exports: []
  };

  function query(table) {
    let rows = data[table] || [];
    let filters = [];
    let orderCol = null;
    let orderAsc = true;
    let limitCount = null;
    let selectCols = null;

    const q = {
      select(cols) {
        selectCols = cols ? cols.split(',').map(c => c.trim()) : null;
        return q;
      },
      eq(col, val) {
        filters.push(r => r[col] === val);
        return q;
      },
      order(col, opts) {
        orderCol = col;
        orderAsc = opts?.ascending ?? true;
        return q;
      },
      limit(n) {
        limitCount = n;
        return q;
      },
      async then(resolve) {
        let result = rows.filter(r => filters.every(f => f(r)));
        if (orderCol) {
          result.sort((a, b) => {
            const va = a[orderCol], vb = b[orderCol];
            if (va < vb) return orderAsc ? -1 : 1;
            if (va > vb) return orderAsc ? 1 : -1;
            return 0;
          });
        }
        if (limitCount) result = result.slice(0, limitCount);
        if (selectCols) {
          result = result.map(r => {
            const obj = {};
            for (const c of selectCols) obj[c] = r[c];
            return obj;
          });
        }
        resolve({ data: result, error: null, count: result.length });
      },
      async single() {
        const r = rows.find(r => filters.every(f => f(r)));
        return { data: r || null, error: r ? null : { code: 'not_found', status: 404 } };
      },
      async maybeSingle() {
        const r = rows.find(r => filters.every(f => f(r)));
        return { data: r || null, error: null };
      },
      async insert(values) {
        const row = Array.isArray(values) ? values : [values];
        for (const r of row) {
          if (!data[table]) data[table] = [];
          data[table].push({ ...r });
        }
        return { data: row, error: null };
      },
      async update(values) {
        for (const r of rows) {
          if (filters.every(f => f(r))) {
            Object.assign(r, values);
          }
        }
        return { data: rows.filter(r => filters.every(f => f(r))), error: null };
      },
      async delete() {
        data[table] = rows.filter(r => !filters.every(f => f(r)));
        return { data: [], error: null };
      }
    };
    return q;
  }

  return { from: query };
}
