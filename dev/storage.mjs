// 本地开发用存储模拟器
export function createStorageClient() {
  const files = new Map();

  return {
    async list(bucket, opts) {
      const items = [];
      for (const [path, data] of files) {
        if (path.startsWith(bucket + '/')) {
          items.push({ name: path, ...data.metadata });
        }
      }
      return items.slice(opts?.offset || 0, (opts?.offset || 0) + (opts?.limit || 20));
    },

    async upload(path, bytes, opts) {
      files.set(path, {
        bytes: new Uint8Array(bytes),
        metadata: {
          content_type: opts?.contentType,
          size: bytes.length,
          created_at: new Date().toISOString()
        }
      });
      return { path };
    },

    async download(path) {
      const file = files.get(path);
      if (!file) {
        return { ok: false, status: 404, body: null, headers: new Map() };
      }
      return {
        ok: true,
        status: 200,
        body: {
          async cancel() {},
          async read() { return { done: true, value: null }; },
          getReader() {
            let done = false;
            return {
              async read() {
                if (done) return { done: true, value: null };
                done = true;
                return { done: false, value: file.bytes };
              },
              releaseLock() {},
              cancel() { done = true; }
            };
          }
        },
        headers: new Map([['content-type', file.metadata.content_type]])
      };
    },

    async remove(paths) {
      for (const p of paths) files.delete(p);
      return { ok: true };
    },

    async createSignedUploadUrl(path, opts) {
      return { signedUrl: `/storage/v1/object/${path}?upload=1` };
    },

    async createSignedUrl(path, expiry) {
      return { signedUrl: `/storage/v1/object/${path}?expires=${expiry}` };
    }
  };
}
