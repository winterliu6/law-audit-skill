const BASE = '';

async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(err.detail || err.msg || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export const api = {
  me: () => request('/api/me'),
  login: (username: string, password: string, deviceFingerprint: string) => {
    const fd = new FormData();
    fd.append('username', username);
    fd.append('password', password);
    fd.append('device_fingerprint', deviceFingerprint);
    return request('/api/login', { method: 'POST', body: fd });
  },
  register: (data: Record<string, string>) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    return request('/api/register', { method: 'POST', body: fd });
  },
  logout: () => request('/api/logout', { method: 'POST' }),

  // Consultation
  consultation: (question: string) =>
    request('/api/consultation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }),
  guestConsultation: (question: string, guestToken: string) =>
    request('/api/guest/consultation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, guest_token: guestToken }),
    }),
  guestConsultCount: (guestToken: string) =>
    request(`/api/guest/consult-count?guest_token=${guestToken}`),

  // Contract
  uploadContract: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/contract/upload', { method: 'POST', body: fd });
  },
  contractStatus: (contractId: number) =>
    request(`/api/contract/${contractId}/status`),
  auditContract: (contractId: number) =>
    request(`/api/contract/${contractId}/audit`, { method: 'POST' }),
  contractRisks: (contractId: number) => request(`/api/contract/${contractId}/risks`),
  downloadDocx: (cid: number) => `/api/contract/${cid}/download-docx`,

  // Work Orders
  workorders: (status?: string) =>
    request(`/api/workorders${status ? `?status=${status}` : ''}`),
  acceptOrder: (orderId: number) =>
    request(`/api/workorder/${orderId}/accept`, { method: 'PUT' }),
  completeOrder: (orderId: number, result: string) =>
    request(`/api/workorder/${orderId}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result }),
    }),
  returnOrder: (orderId: number, reason: string) =>
    request(`/api/workorder/${orderId}/return`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),

  // History
  history: () => request('/api/history'),

  // Contract Templates
  templateCategories: () => request('/api/contract-template/categories'),
  templateList: (category?: string) =>
    request(`/api/contract-template/list${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  templateFields: (id: number) => request(`/api/contract-template/${id}/auto-fields`),
  generateContract: (data: { template_id: number; filled_data: Record<string, string>; title: string }) =>
    request('/api/contract-template/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  dashboard: () => request('/api/dashboard'),
  templateHistory: () => request('/api/contract-template/history'),

  // Admin
  changePassword: (userId: number, newPassword: string) =>
    request('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, new_password: newPassword }),
    }),
  switchModel: (model: string) =>
    request('/api/admin/switch-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    }),
  modelStatus: () => request('/api/admin/model-status'),
  orgTree: () => request('/api/admin/org/tree'),
  orgOptions: () => request('/api/org/options'),
  adminUsers: () => request('/api/admin/users'),
  adminStats: () => request('/api/admin/stats'),
  adminWorkorders: () => request('/api/admin/workorders'),
  kbUpload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/admin/kb/upload', { method: 'POST', body: fd });
  },
  kbRebuild: () => request('/api/admin/kb/rebuild', { method: 'POST' }),
  adminTemplateCategories: () => request('/api/contract-template/admin/categories'),
  adminTemplateList: () => request('/api/contract-template/admin/list'),
  adminTemplateUpload: (fd: FormData) =>
    request('/api/contract-template/admin/upload', { method: 'POST', body: fd }),
  adminTemplateToggle: (id: number) =>
    request(`/api/contract-template/admin/${id}/toggle`, { method: 'PUT' }),
  adminTemplateDelete: (id: number) =>
    request(`/api/contract-template/admin/${id}`, { method: 'DELETE' }),
  adminTemplateAutoDetect: (id: number) =>
    request(`/api/contract-template/admin/${id}/auto-detect`, { method: 'POST' }),
  adminOrgAdd: (data: any) =>
    request('/api/admin/org/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  adminOrgUpload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/admin/org/upload', { method: 'POST', body: fd });
  },
  adminOrgDisable: (id: number) =>
    request(`/api/admin/org/${id}/disable`, { method: 'PUT' }),
  adminOrgDelete: (id: number) =>
    request(`/api/admin/org/${id}`, { method: 'DELETE' }),
  adminDeviceApprove: (id: number) =>
    request(`/api/admin/device/approve/${id}`, { method: 'POST' }),
  adminUserCreate: (data: any) =>
    request('/api/admin/user/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  adminUserToggle: (id: number) =>
    request(`/api/admin/user/${id}/toggle`, { method: 'PUT' }),
};
