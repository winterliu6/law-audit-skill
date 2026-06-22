# 法务审核系统 — 全面优化报告

> **日期**: 2026-06-22 | **版本**: v2.1.0  
> **回滚**: `git checkout 3f21f11` 即可恢复到修改前状态

---

## 一、Bug 修复清单 🐛

### 后端修复（4处）

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 1 | `database.py` | 全文件 `datetime.utcnow()` 已废弃（Python 3.12+） | 改为 `datetime.now(timezone.utc)` |
| 2 | `audit.py:100` | 使用 `chr(37)` 做 f-string 日期格式化 | 改为 `{datetime.now():%Y%m%d_%H%M%S}` |
| 3 | `contract_template/api.py:354` | `typing.Optional` 未导入 `typing` 模块 | 改为 `Optional`（已从 typing 导入） |
| 4 | `dispatcher.py` | `datetime.utcnow()` 废弃 | 全部改为 `datetime.now(timezone.utc)` |

### 前端修复（4处）

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 5 | `index.html:156` | `openModal()` 函数 if-else 语法错误 | 重写为正确的 if-else 结构 |
| 6 | `contract_template.html:409` | API 返回 `data.title`/`data.download_url`，但代码使用不存在的 `data.file_name`/`data.record_id` | 纠正字段映射 |
| 7 | `work_order.html` | 工单状态：前端用 `accepted`，后端用 `processing` | 统一为 `processing` |
| 8 | 多处 HTML | Unicode 转义 `\u6a21\u578b` 等替代中文 | 改用直接中文 |

---

## 二、UI 全面重做 🎨

### 技术栈

| 层级 | 旧方案 | 新方案 |
|------|--------|--------|
| 框架 | 原生 HTML/CSS/JS | **React 19 + TypeScript** |
| 构建 | 无 | **Vite 7** |
| 样式 | 手写 CSS | **Tailwind CSS + shadcn/ui 50+ 组件** |
| 图标 | Emoji | **Lucide Icons (1000+ SVG)** |
| 路由 | 6 个独立 HTML | **React Router (SPA)** |
| 主题 | 仅浅色 | **浅色 + 深色（自动跟随系统）** |

### 设计原则

- **左侧导航侧边栏**（Vercel Dashboard 风格）— 桌面端固定，移动端抽屉式
- **卡片式布局** — 统一使用 shadcn/ui Card 组件，圆角 12px + 微阴影
- **Indigo 主色调** — `#4f46e5` 渐变，替代旧版深蓝 `#1a237e`
- **完整状态覆盖** — 每个页面都有 Loading/Empty/Error 三种状态
- **响应式** — Mobile-first，所有页面在手机端可用

### 6 个页面特性

| 页面 | 亮点 |
|------|------|
| **法务咨询** | 聊天界面 + 欢迎推荐问题 + 游客/登录双模式 + 打字指示器动画 |
| **合同审核** | 拖拽上传区 + 合同列表表格 + 风险结果彩色卡片 + 轮询审核状态 |
| **工单管理** | 状态筛选标签 + 卡片列表 + Dialog 弹出完成/退回表单 |
| **历史记录** | 双栏布局（咨询+合同）+ 下载链接 + 独立空状态 |
| **合同模板** | 左右分栏 + 智能字段检测 + 手动添加字段 + 生成结果下载 |
| **管理后台** | 5 标签页（概览/知识库/组织架构/用户/模板）+ 完整 CRUD |

---

## 三、功能改进建议 💡

基于代码审核，以下是进一步提升的 10 项建议：

### 🔴 P0 — 安全（必须处理）

1. **强制修改默认密码和 SECRET_KEY**
   - `admin/admin123` 硬编码在 `database.py:151`
   - `SECRET_KEY = "CHANGE-ME-IN-PRODUCTION"` 在 `config.py:37`
   - **建议**: 首次启动检测是否还是默认值 → 拒绝启动并打印警告

2. **添加 CSRF 保护**
   - 目前 Cookie 设置了 httponly，但无 CSRF token
   - **建议**: 使用 `fastapi-csrf-protect` 或自定义中间件

3. **文件上传限制**
   - API 无文件大小限制，可能存在 DoS 风险
   - **建议**: 在 FastAPI 中设置 `MAX_UPLOAD_SIZE = 20 * 1024 * 1024`

### 🟡 P1 — 功能增强

4. **合同比对功能**
   - `audit.py` 中已有 `compare_contracts()` 函数但前端未暴露
   - **建议**: 在合同审核页添加"上传对比合同"入口

5. **批量审核**
   - 当前一次只能审核一个合同
   - **建议**: 支持多选合同 → 批量提交审核

6. **审核报告导出增强**
   - 仅支持 DOCX 格式
   - **建议**: 添加 PDF 导出（使用 reportlab 或 weasyprint）

7. **通知系统**
   - 工单状态变更无通知
   - **建议**: 轮询 + 浏览器 Notification API，或集成企业微信/飞书 Webhook

### 🟢 P2 — 体验优化

8. **合同关键信息提取可视化**
   - `extract_key_info()` 已实现但无前端展示
   - **建议**: 审核结果页增加合同关键信息摘要卡片（主体/金额/日期）

9. **知识库管理增强**
   - 仅支持上传和重建，无文档预览/删除/检索测试
   - **建议**: 添加知识库文档列表 + 搜索测试输入框

10. **操作审计日志**
    - 无任何操作日志记录
    - **建议**: 添加 `AuditLog` 表，记录所有关键操作（登录/审核/工单变更/模板变更）
