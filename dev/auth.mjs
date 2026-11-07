// 本地开发用认证模块（模拟）
export class UserContextError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'UserContextError';
    this.code = code;
    this.status = status;
  }
}

const LOCAL_USER = {
  user_id: 'local-dev-user-0000-0000-000000000000',
  name: '本地开发者',
  picture: '',
  site_id: 'local-site',
  host_id: 'local-host',
  session_expires_at: Math.floor(Date.now() / 1000) + 86400
};

export function getUser(request) {
  // 本地开发模式：返回模拟用户
  return LOCAL_USER;
}

export function requireUser(request) {
  return LOCAL_USER;
}
