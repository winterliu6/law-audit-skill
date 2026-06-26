import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  LayoutDashboard,
  BookOpen,
  Network,
  Users,
  FileText,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  Building,
  FolderTree,
  User as UserIcon,
  Shield,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Search,
  X,
  LogIn,
  Power,
  FileSpreadsheet,
  Headphones,
  Scale,
  ListChecks,
  Library,
  Sparkles,
} from 'lucide-react';

// ===========================================================================
// Types
// ===========================================================================

type PageAlert = { type: 'success' | 'error'; text: string } | null;

interface RoleStat {
  total: number;
  done: number;
}

interface OrgNode {
  id: number;
  name: string;
  type: string; // company | dept | person
  enabled?: boolean;
  title?: string;
  children?: OrgNode[];
}

interface AdminUser {
  id: number;
  username: string;
  role: string;
  company?: string;
  department?: string;
  full_name?: string;
  enabled: boolean;
}

interface AdminTemplate {
  id: number;
  name: string;
  category: string;
  description?: string;
  active: boolean;
  fields_count?: number;
  file_path?: string;
}

// ===========================================================================
// Constants
// ===========================================================================

const ROLE_CONFIG: Record<
  string,
  { label: string; icon: typeof Headphones; color: string }
> = {
  csr: { label: '客服', icon: Headphones, color: 'text-sky-500' },
  law: { label: '法务', icon: Scale, color: 'text-indigo-500' },
  audit: { label: '审核', icon: ShieldCheck, color: 'text-emerald-500' },
  sort: { label: '整理', icon: ListChecks, color: 'text-amber-500' },
  kb: { label: '知识库', icon: Library, color: 'text-violet-500' },
};

const ORG_TYPE_ICON: Record<string, typeof Building> = {
  company: Building,
  dept: FolderTree,
  person: UserIcon,
};

const ORG_TYPE_LABEL: Record<string, string> = {
  company: '公司',
  dept: '部门',
  person: '人员',
};

const ACCEPTED_DOC_TYPES = '.pdf,.docx,.txt';
const ACCEPTED_EXCEL_TYPES = '.xlsx,.xls';

// ===========================================================================
// Shared helpers
// ===========================================================================

function flattenOrgTree(
  nodes: OrgNode[],
  depth = 0
): { node: OrgNode; depth: number }[] {
  const result: { node: OrgNode; depth: number }[] = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.children && node.children.length > 0) {
      result.push(...flattenOrgTree(node.children, depth + 1));
    }
  }
  return result;
}

// ===========================================================================
// Login / access prompt
// ===========================================================================

function AccessPrompt() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center py-10">
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-500">
            <Shield className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              管理员权限
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              管理后台仅限管理员账号访问。请登录管理员账号后继续操作。
            </p>
          </div>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
            onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
          >
            <LogIn className="w-4 h-4" />
            登录管理员账号
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Tab 1: OverviewTab — 概览
// ===========================================================================

function StatCard({
  roleKey,
  stat,
}: {
  roleKey: string;
  stat: RoleStat;
}) {
  const cfg = ROLE_CONFIG[roleKey] || {
    label: roleKey,
    icon: Users,
    color: 'text-slate-500',
  };
  const Icon = cfg.icon;
  const percent = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;

  return (
    <Card className="p-0 gap-0">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800', cfg.color)}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {cfg.label}
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            {percent}%
          </Badge>
        </div>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">总数</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.total}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">已完成</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stat.done}</p>
          </div>
          <div className="ml-auto">
            <p className="text-xs text-slate-400 dark:text-slate-500">待处理</p>
            <p className="text-xl font-bold text-amber-500">{stat.total - stat.done}</p>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<Record<string, RoleStat>>({});
  const [modelInfo, setModelInfo] = useState<{ model: string; synced: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, modelRes] = await Promise.all([
        api.adminStats(),
        api.modelStatus(),
      ]);

      // Parse stats
      const sr = statsRes as { code?: number; data?: unknown };
      if (sr?.code === 0 && sr.data && typeof sr.data === 'object') {
        const d = sr.data as Record<string, unknown>;
        const parsed: Record<string, RoleStat> = {};
        for (const key of Object.keys(ROLE_CONFIG)) {
          const val = d[key];
          if (val && typeof val === 'object') {
            const v = val as Record<string, unknown>;
            parsed[key] = {
              total: typeof v.total === 'number' ? v.total : 0,
              done: typeof v.done === 'number' ? v.done : typeof v.completed === 'number' ? v.completed : 0,
            };
          } else if (typeof val === 'number') {
            parsed[key] = { total: val, done: 0 };
          }
        }
        setStats(parsed);
      }

      // Parse model status
      const mr = modelRes as { code?: number; data?: unknown };
      if (mr?.code === 0 && mr.data && typeof mr.data === 'object') {
        const d = mr.data as Record<string, unknown>;
        const rawModel = d.model;
        const model =
          typeof rawModel === 'object' && rawModel !== null
            ? (rawModel as Record<string, unknown>).default as string || (rawModel as Record<string, unknown>).name as string || '未配置'
            : (rawModel as string) || '未配置';
        setModelInfo({ model, synced: d.synced === true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-400 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4" />
          重试
        </Button>
      </div>
    );
  }

  const statKeys = Object.keys(ROLE_CONFIG);

  return (
    <div className="space-y-4">
      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-3.5 h-3.5" />
          刷新数据
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statKeys.map((key) => (
          <StatCard
            key={key}
            roleKey={key}
            stat={stats[key] || { total: 0, done: 0 }}
          />
        ))}
      </div>

      {/* Model status */}
      <Card className="p-0 gap-0">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            模型状态
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {modelInfo ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 dark:text-slate-500">当前模型</span>
                <Badge variant="secondary" className="font-mono">
                  {modelInfo.model}
                </Badge>
              </div>
              <select
                className="px-2 py-1 rounded border border-slate-300 text-xs font-mono bg-white dark:bg-slate-800"
                value={modelInfo.model}
                onChange={(e) => {
                  const val = e.target.value;
                  const prev = modelInfo.model;
                  setModelInfo((p) => p ? { ...p, model: val } : p);
                  api.switchModel(val).then((res) => {
                    const r = res;
                    if (r?.code !== 0) setModelInfo((p) => p ? { ...p, model: prev } : p);
                  }).catch(() => setModelInfo((p) => p ? { ...p, model: prev } : p));
                }}
              >
                <option value="MiniMax-M2.7">MiniMax-M2.7</option>
                <option value="MiniMax-M2.5">MiniMax-M2.5</option>
                <option value="mimo-v2.5-pro">mimo-v2.5-pro</option>
                <option value="deepseek-v4-flash">deepseek-v4-flash</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                onClick={() => {
                  api.switchModel(modelInfo.model).then((res) => {
                    const r = res;
                    if (r?.code !== 0) alert('切换失败');
                  }).catch(() => alert('切换失败'));
                }}
              >应用</Button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 dark:text-slate-500">同步状态</span>
                {modelInfo.synced ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900">
                    <CheckCircle className="w-3 h-3" />
                    已同步
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900">
                    <AlertTriangle className="w-3 h-3" />
                    未同步
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">暂无模型状态信息</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Tab 2: KnowledgeBaseTab — 知识库
// ===========================================================================

function KnowledgeBaseTab() {
  const [uploading, setUploading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [alert, setAlert] = useState<PageAlert>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setAlert(null);
    try {
      const res = await api.kbUpload(file);
      const r = res as { code?: number; msg?: string };
      if (r?.code === 0) {
        setAlert({ type: 'success', text: `文件「${file.name}」上传成功，已加入知识库。` });
      } else {
        throw new Error(r?.msg || '上传失败');
      }
    } catch (err) {
      setAlert({
        type: 'error',
        text: err instanceof Error ? err.message : '上传失败，请重试',
      });
    } finally {
      setUploading(false);
    }
  }, []);

  const handleRebuild = useCallback(async () => {
    setRebuilding(true);
    setAlert(null);
    try {
      const res = await api.kbRebuild();
      const r = res as { code?: number; msg?: string };
      if (r?.code === 0) {
        setAlert({ type: 'success', text: '知识库索引重建已启动，请稍候。' });
      } else {
        throw new Error(r?.msg || '重建失败');
      }
    } catch (err) {
      setAlert({
        type: 'error',
        text: err instanceof Error ? err.message : '重建索引失败，请重试',
      });
    } finally {
      setRebuilding(false);
    }
  }, []);

  return (
    <div className="space-y-4 max-w-3xl">
      {alert && (
        <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
          {alert.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <AlertTitle>{alert.type === 'success' ? '操作成功' : '操作失败'}</AlertTitle>
          <AlertDescription>{alert.text}</AlertDescription>
        </Alert>
      )}

      {/* Upload zone */}
      <Card className="p-0 gap-0">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            上传法律文档
          </CardTitle>
          <CardDescription className="text-xs">
            支持 PDF、DOCX、TXT 格式，上传后将自动加入知识库索引
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (uploading) return;
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all duration-200',
              dragOver
                ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-900/50',
              uploading && 'pointer-events-none opacity-60'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_DOC_TYPES}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />
            <div
              className={cn(
                'flex items-center justify-center w-14 h-14 rounded-xl transition-colors',
                dragOver
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              )}
            >
              {uploading ? <Spinner className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {uploading
                  ? '正在上传…'
                  : dragOver
                    ? '释放鼠标以上传文件'
                    : '拖拽法律文档到此处，或点击选择文件'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                支持 PDF、DOCX、TXT 格式
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rebuild index */}
      <Card className="p-0 gap-0">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-500" />
            重建索引
          </CardTitle>
          <CardDescription className="text-xs">
            上传新文档后，需要重建索引才能在咨询中检索到最新内容
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            重建操作将重新处理知识库中的所有文档，可能需要较长时间。
          </p>
          <Button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
          >
            {rebuilding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                重建中…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                重建索引
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Tab 3: OrgTreeTab — 组织架构
// ===========================================================================

function OrgTreeNodeRow({
  node,
  depth,
  onToggle,
  onDelete,
}: {
  node: OrgNode;
  depth: number;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const Icon = ORG_TYPE_ICON[node.type] || UserIcon;
  const isDisabled = node.enabled === false;

  return (
    <>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <Icon
          className={cn(
            'w-4 h-4 flex-shrink-0',
            node.type === 'company'
              ? 'text-indigo-500'
              : node.type === 'dept'
                ? 'text-amber-500'
                : 'text-slate-400'
          )}
        />
        <span
          className={cn(
            'text-sm flex-1 truncate',
            isDisabled
              ? 'text-slate-400 dark:text-slate-600 line-through'
              : 'text-slate-800 dark:text-slate-200'
          )}
        >
          {node.name}
        </span>
        {node.title && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {node.title}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-slate-400">
          {ORG_TYPE_LABEL[node.type] || node.type}
        </Badge>
        {isDisabled && (
          <Badge className="text-[10px] py-0 px-1.5 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            已禁用
          </Badge>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => onToggle(node.id)}
            className={cn(
              'h-7 w-7',
              isDisabled
                ? 'text-slate-400 hover:text-emerald-500'
                : 'text-slate-400 hover:text-amber-500'
            )}
            title={isDisabled ? '启用' : '禁用'}
          >
            <Power className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => onDelete(node.id)}
            className="h-7 w-7 text-slate-400 hover:text-red-500"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {node.children?.map((child) => (
        <OrgTreeNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

function OrgTreeTab() {
  const [rootNodes, setRootNodes] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [alert, setAlert] = useState<PageAlert>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Add form state
  const [newType, setNewType] = useState('dept');
  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.orgTree();
      const r = res as { code?: number; data?: unknown };
      if (r?.code === 0) {
        if (Array.isArray(r.data)) {
          setRootNodes(r.data as OrgNode[]);
        } else if (r.data && typeof r.data === 'object') {
          setRootNodes([r.data as OrgNode]);
        } else {
          setRootNodes([]);
        }
      } else {
        setRootNodes([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载组织架构失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const flatNodes = useMemo(() => flattenOrgTree(rootNodes), [rootNodes]);

  const handleAdd = useCallback(async () => {
    if (!newName.trim() || submitting) return;
    setSubmitting(true);
    setAlert(null);
    try {
      const data: Record<string, unknown> = {
        type: newType,
        name: newName.trim(),
      };
      if (newParent) data.parent_id = Number(newParent);
      const res = await api.adminOrgAdd(data);
      const r = res as { code?: number; msg?: string };
      if (r?.code === 0) {
        setAlert({ type: 'success', text: '节点添加成功' });
        setAddOpen(false);
        setNewName('');
        setNewParent('');
        setNewType('dept');
        fetchTree();
      } else {
        throw new Error(r?.msg || '添加失败');
      }
    } catch (err) {
      setAlert({
        type: 'error',
        text: err instanceof Error ? err.message : '添加节点失败',
      });
    } finally {
      setSubmitting(false);
    }
  }, [newType, newName, newParent, submitting, fetchTree]);

  const handleToggle = useCallback(
    async (id: number) => {
      setAlert(null);
      try {
        await api.adminOrgDisable(id);
        fetchTree();
      } catch (err) {
        setAlert({
          type: 'error',
          text: err instanceof Error ? err.message : '操作失败',
        });
      }
    },
    [fetchTree]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      setAlert(null);
      try {
        await api.adminOrgDelete(id);
        setAlert({ type: 'success', text: '节点已删除' });
        fetchTree();
      } catch (err) {
        setAlert({
          type: 'error',
          text: err instanceof Error ? err.message : '删除失败',
        });
      }
    },
    [fetchTree]
  );

  const handleExcelUpload = useCallback(
    async (file: File) => {
      setExcelUploading(true);
      setAlert(null);
      try {
        const res = await api.adminOrgUpload(file);
        const r = res as { code?: number; msg?: string };
        if (r?.code === 0) {
          setAlert({ type: 'success', text: `Excel 导入成功` });
          fetchTree();
        } else {
          throw new Error(r?.msg || '导入失败');
        }
      } catch (err) {
        setAlert({
          type: 'error',
          text: err instanceof Error ? err.message : 'Excel 导入失败',
        });
      } finally {
        setExcelUploading(false);
      }
    },
    [fetchTree]
  );

  return (
    <div className="space-y-4">
      {alert && (
        <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
          {alert.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <AlertDescription>{alert.text}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Network className="w-4 h-4 text-indigo-500" />
          组织架构树
        </h3>
        <div className="flex items-center gap-2">
          <input
            ref={excelInputRef}
            type="file"
            accept={ACCEPTED_EXCEL_TYPES}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleExcelUpload(file);
              e.target.value = '';
            }}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => excelInputRef.current?.click()}
            disabled={excelUploading}
          >
            {excelUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            )}
            Excel 导入
          </Button>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            添加节点
          </Button>
        </div>
      </div>

      <Card className="p-0 gap-0">
        <CardContent className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="w-5 h-5 text-indigo-500" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchTree}>
                重试
              </Button>
            </div>
          ) : rootNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Network className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                暂无组织架构数据
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                点击「添加节点」或「Excel 导入」开始构建
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-24rem)] min-h-[300px]">
              <div className="space-y-0.5">
                {rootNodes.map((node) => (
                  <OrgTreeNodeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Add node dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加组织节点</DialogTitle>
            <DialogDescription>
              选择节点类型并填写名称，可选择父级节点
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">节点类型</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="dept">部门</SelectItem>
                  <SelectItem value="person">人员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">名称</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="请输入节点名称"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">父级节点（可选）</Label>
              <Select value={newParent} onValueChange={setNewParent}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="无（作为根节点）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">无（作为根节点）</SelectItem>
                  {flatNodes.map(({ node, depth }) => (
                    <SelectItem key={node.id} value={String(node.id)}>
                      {'　'.repeat(depth)}{node.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!newName.trim() || submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===========================================================================
// Tab 4: UserManagementTab — 用户管理
// ===========================================================================

function UserManagementTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [alert, setAlert] = useState<PageAlert>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create form state
  const [form, setForm] = useState({
    username: '',
    password: '',
    company: '',
    department: '',
    full_name: '',
    role: 'csr',
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminUsers();
      const r = res as { code?: number; data?: unknown };
      if (r?.code === 0 && Array.isArray(r.data)) {
        setUsers(
          r.data.map((item) => {
            const u = item as Record<string, unknown>;
            return {
              id: u.id as number,
              username: (u.username as string) || '',
              role: (u.role as string) || '',
              company: (u.company as string) || undefined,
              department: (u.department as string) || (u.dept as string) || undefined,
              full_name: (u.full_name as string) || (u.name as string) || undefined,
              enabled: u.enabled !== false && u.enabled !== 0,
            };
          })
        );
      } else {
        setUsers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = useCallback(async () => {
    if (!form.username.trim() || !form.password.trim() || submitting) return;
    setSubmitting(true);
    setAlert(null);
    try {
      const res = await api.adminUserCreate({
        username: form.username.trim(),
        password: form.password,
        company: form.company.trim(),
        department: form.department.trim(),
        full_name: form.full_name.trim(),
        role: form.role,
      });
      const r = res as { code?: number; msg?: string };
      if (r?.code === 0) {
        setAlert({ type: 'success', text: `用户「${form.username}」创建成功` });
        setCreateOpen(false);
        setForm({
          username: '',
          password: '',
          company: '',
          department: '',
          full_name: '',
          role: 'csr',
        });
        fetchUsers();
      } else {
        throw new Error(r?.msg || '创建失败');
      }
    } catch (err) {
      setAlert({
        type: 'error',
        text: err instanceof Error ? err.message : '创建用户失败',
      });
    } finally {
      setSubmitting(false);
    }
  }, [form, submitting, fetchUsers]);

  const handleToggle = useCallback(
    async (id: number) => {
      setTogglingId(id);
      setAlert(null);
      try {
        await api.adminUserToggle(id);
        fetchUsers();
      } catch (err) {
        setAlert({
          type: 'error',
          text: err instanceof Error ? err.message : '操作失败',
        });
      } finally {
        setTogglingId(null);
      }
    },
    [fetchUsers]
  );

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.company || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  return (
    <div className="space-y-4">
      {alert && (
        <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
          {alert.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <AlertDescription>{alert.text}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索用户…"
            className="h-9 pl-8 text-sm bg-white dark:bg-slate-950"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          创建用户
        </Button>
      </div>

      <Card className="p-0 gap-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="w-5 h-5 text-indigo-500" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchUsers}>
                重试
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {searchQuery ? '未找到匹配的用户' : '暂无用户'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableHead className="pl-4">用户名</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead className="hidden sm:table-cell">公司</TableHead>
                    <TableHead className="hidden md:table-cell">部门</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right pr-4">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex-shrink-0">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                              {u.username}
                            </p>
                            {u.full_name && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                                {u.full_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ROLE_CONFIG[u.role]?.label || u.role || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-slate-500 dark:text-slate-400">
                        {u.company || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-slate-500 dark:text-slate-400">
                        {u.department || '—'}
                      </TableCell>
                      <TableCell>
                        {u.enabled ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900">
                            <CheckCircle className="w-3 h-3" />
                            启用
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                            <X className="w-3 h-3" />
                            禁用
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggle(u.id)}
                          disabled={togglingId === u.id}
                          className={cn(
                            u.enabled
                              ? 'text-amber-600 hover:text-amber-700'
                              : 'text-emerald-600 hover:text-emerald-700'
                          )}
                        >
                          {togglingId === u.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                          {u.enabled ? '禁用' : '启用'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>创建用户</DialogTitle>
            <DialogDescription>填写用户信息以创建新账号</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">用户名 <span className="text-red-500">*</span></Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="登录用户名"
                  className="bg-white dark:bg-slate-950"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">密码 <span className="text-red-500">*</span></Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="登录密码"
                  className="bg-white dark:bg-slate-950"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">角色</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">公司</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="所属公司"
                  className="bg-white dark:bg-slate-950"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">部门</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  placeholder="所属部门"
                  className="bg-white dark:bg-slate-950"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">姓名</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="真实姓名（可选）"
                className="bg-white dark:bg-slate-950"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.username.trim() || !form.password.trim() || submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===========================================================================
// Tab 5: TemplateManagementTab — 合同模板
// ===========================================================================

function TemplateManagementTab() {
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [alert, setAlert] = useState<PageAlert>(null);

  // Upload form state
  const [form, setForm] = useState({
    name: '',
    category: '',
    description: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminTemplateList();
      const r = res as { code?: number; data?: unknown };
      if (r?.code === 0 && Array.isArray(r.data)) {
        setTemplates(
          r.data.map((item) => {
            const t = item as Record<string, unknown>;
            return {
              id: t.id as number,
              name: (t.name as string) || (t.template_name as string) || '',
              category: (t.category as string) || '未分类',
              description: (t.description as string) || (t.desc as string) || '',
              active: t.active !== false && t.active !== 0 && t.enabled !== false,
              fields_count: typeof t.fields_count === 'number' ? t.fields_count : 0,
              file_path: (t.file_path as string) || undefined,
            };
          })
        );
      } else {
        setTemplates([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载模板列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleUpload = useCallback(async () => {
    if (!form.name.trim() || !file || submitting) return;
    setSubmitting(true);
    setAlert(null);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('category', form.category.trim() || '通用');
      fd.append('description', form.description.trim());
      fd.append('file', file);
      const res = await api.adminTemplateUpload(fd);
      const r = res as { code?: number; msg?: string };
      if (r?.code === 0) {
        setAlert({ type: 'success', text: `模板「${form.name}」上传成功` });
        setUploadOpen(false);
        setForm({ name: '', category: '', description: '' });
        setFile(null);
        fetchTemplates();
      } else {
        throw new Error(r?.msg || '上传失败');
      }
    } catch (err) {
      setAlert({
        type: 'error',
        text: err instanceof Error ? err.message : '上传模板失败',
      });
    } finally {
      setSubmitting(false);
    }
  }, [form, file, submitting, fetchTemplates]);

  const handleToggle = useCallback(
    async (id: number) => {
      setActionId(id);
      setAlert(null);
      try {
        await api.adminTemplateToggle(id);
        fetchTemplates();
      } catch (err) {
        setAlert({
          type: 'error',
          text: err instanceof Error ? err.message : '操作失败',
        });
      } finally {
        setActionId(null);
      }
    },
    [fetchTemplates]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      setActionId(id);
      setAlert(null);
      try {
        await api.adminTemplateDelete(id);
        setAlert({ type: 'success', text: '模板已删除' });
        fetchTemplates();
      } catch (err) {
        setAlert({
          type: 'error',
          text: err instanceof Error ? err.message : '删除失败',
        });
      } finally {
        setActionId(null);
      }
    },
    [fetchTemplates]
  );

  const handleAutoDetect = useCallback(
    async (id: number) => {
      setActionId(id);
      setAlert(null);
      try {
        const res = await api.adminTemplateAutoDetect(id);
        const r = res as { code?: number; msg?: string; data?: unknown };
        if (r?.code === 0) {
          const count =
            r.data && typeof r.data === 'object'
              ? (r.data as Record<string, unknown>).fields_count
              : r.data;
          setAlert({
            type: 'success',
            text:
              typeof count === 'number'
                ? `字段检测完成，共识别 ${count} 个字段`
                : '字段检测完成',
          });
          fetchTemplates();
        } else {
          throw new Error(r?.msg || '检测失败');
        }
      } catch (err) {
        setAlert({
          type: 'error',
          text: err instanceof Error ? err.message : '字段检测失败',
        });
      } finally {
        setActionId(null);
      }
    },
    [fetchTemplates]
  );

  return (
    <div className="space-y-4">
      {alert && (
        <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
          {alert.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <AlertDescription>{alert.text}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          模板列表
          {templates.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {templates.length}
            </Badge>
          )}
        </h3>
        <Button
          size="sm"
          onClick={() => setUploadOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Upload className="w-3.5 h-3.5" />
          上传模板
        </Button>
      </div>

      <Card className="p-0 gap-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="w-5 h-5 text-indigo-500" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchTemplates}>
                重试
              </Button>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                暂无合同模板
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                点击「上传模板」添加新的合同模板
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableHead className="pl-4">模板名称</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead className="hidden md:table-cell">字段数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right pr-4">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex-shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                              {t.name}
                            </p>
                            {t.description && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                                {t.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {t.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-slate-500 dark:text-slate-400">
                        {t.fields_count || 0}
                      </TableCell>
                      <TableCell>
                        {t.active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900">
                            <CheckCircle className="w-3 h-3" />
                            启用
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                            <X className="w-3 h-3" />
                            停用
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAutoDetect(t.id)}
                            disabled={actionId === t.id}
                            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                          >
                            {actionId === t.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">检测字段</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggle(t.id)}
                            disabled={actionId === t.id}
                            className={cn(
                              t.active
                                ? 'text-amber-600 hover:text-amber-700'
                                : 'text-emerald-600 hover:text-emerald-700'
                            )}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t.active ? '停用' : '启用'}</span>
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDelete(t.id)}
                            disabled={actionId === t.id}
                            className="text-slate-400 hover:text-red-500"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload template dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>上传合同模板</DialogTitle>
            <DialogDescription>
              上传 DOCX 模板文件，系统将自动检测可填充字段
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">模板名称 <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：标准劳动合同"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">分类</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="如：劳动合同"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">描述</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="模板用途说明（可选）"
                rows={2}
                className="bg-white dark:bg-slate-950 resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">模板文件 <span className="text-red-500">*</span></Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 p-3 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFile(f);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex-shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  {file ? (
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                      {file.name}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      点击选择 DOCX 模板文件
                    </p>
                  )}
                </div>
                {file && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-slate-400 hover:text-red-500 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!form.name.trim() || !file || submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              上传
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===========================================================================
// Main Admin page
// ===========================================================================

export default function Admin() {
  const { user } = useAuth();

  // Guard: must be logged in and an admin
  if (!user) {
    return <AccessPrompt />;
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 text-white shadow-lg shadow-slate-500/25">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">管理后台</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            系统概览 · 知识库 · 组织架构 · 用户 · 模板管理
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <ScrollArea className="w-full">
          <TabsList className="flex w-max min-w-full">
            <TabsTrigger value="overview" className="flex-1 gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" />
              概览
            </TabsTrigger>
            <TabsTrigger value="kb" className="flex-1 gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              知识库
            </TabsTrigger>
            <TabsTrigger value="org" className="flex-1 gap-1.5">
              <Network className="w-3.5 h-3.5" />
              组织架构
            </TabsTrigger>
            <TabsTrigger value="users" className="flex-1 gap-1.5">
              <Users className="w-3.5 h-3.5" />
              用户管理
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-1 gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              合同模板
            </TabsTrigger>
          </TabsList>
        </ScrollArea>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="kb" className="mt-4">
          <KnowledgeBaseTab />
        </TabsContent>
        <TabsContent value="org" className="mt-4">
          <OrgTreeTab />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UserManagementTab />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplateManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
