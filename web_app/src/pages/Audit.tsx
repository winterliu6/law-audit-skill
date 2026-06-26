import { useState, useRef, useCallback, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  FileText,
  Shield,
  Download,
  AlertTriangle,
  CheckCircle,
  LogIn,
  FileSearch,
  Clock,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContractStatus = 'pending' | 'processing' | 'done' | 'error';

type RiskSeverity = 'high' | 'medium' | 'low';

interface Contract {
  id: number;
  filename: string;
  fileSize: number;
  uploadedAt: Date;
  status: ContractStatus;
}

interface RiskItem {
  category: string;
  description: string;
  severity: RiskSeverity;
  suggestion?: string;
  clause?: string;
}

interface AuditResult {
  summary: string;
  riskLevel: RiskSeverity;
  risks: RiskItem[];
  score?: number;
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES = ['.pdf', '.docx', '.txt'];
const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isValidFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_TYPES.includes(ext) || ACCEPTED_MIME.includes(file.type);
}

/**
 * Normalise the audit API response into a structured AuditResult.
 * Handles multiple possible response shapes from the backend.
 */
function parseAuditResult(res: unknown): AuditResult {
  const r = res as { code?: number; data?: unknown; msg?: string };
  const rawData = r?.data;

  // data is a plain string — treat as summary
  if (typeof rawData === 'string') {
    return {
      summary: rawData,
      riskLevel: 'low',
      risks: [],
    };
  }

  if (!rawData || typeof rawData !== 'object') {
    return {
      summary: r?.msg || '审核完成，未返回详细结果。',
      riskLevel: 'low',
      risks: [],
    };
  }

  const d = rawData as Record<string, unknown>;

  // data.result may be a nested object or string
  let source: Record<string, unknown> = d;
  if (d.result && typeof d.result === 'object') {
    source = d.result as Record<string, unknown>;
  } else if (typeof d.result === 'string') {
    return { summary: d.result, riskLevel: 'low', risks: [] };
  }

  const summary =
    (typeof source.summary === 'string' && source.summary) ||
    (typeof source.conclusion === 'string' && source.conclusion) ||
    (typeof source.overall === 'string' && source.overall) ||
    '审核完成。';

  const rawLevel = source.risk_level || source.riskLevel || source.level;
  const riskLevel: RiskSeverity =
    rawLevel === 'high' ? 'high' : rawLevel === 'medium' ? 'medium' : 'low';

  const rawRisks = source.risks || source.items || source.issues;
  const risks: RiskItem[] = Array.isArray(rawRisks)
    ? rawRisks.map((item, idx) => {
        const ri = (item || {}) as Record<string, unknown>;
        const sev = ri.severity || ri.level || ri.risk_level;
        return {
          category:
            (typeof ri.category === 'string' && ri.category) ||
            (typeof ri.title === 'string' && ri.title) ||
            (typeof ri.type === 'string' && ri.type) ||
            `风险点 ${idx + 1}`,
          description:
            (typeof ri.description === 'string' && ri.description) ||
            (typeof ri.content === 'string' && ri.content) ||
            (typeof ri.detail === 'string' && ri.detail) ||
            '未提供详细描述。',
          severity:
            sev === 'high' ? 'high' : sev === 'medium' ? 'medium' : 'low',
          suggestion:
            typeof ri.suggestion === 'string'
              ? ri.suggestion
              : typeof ri.advice === 'string'
                ? ri.advice
                : typeof ri.recommendation === 'string'
                  ? ri.recommendation
                  : undefined,
          clause: typeof ri.clause === 'string' ? ri.clause : undefined,
        };
      })
    : [];

  const score =
    typeof source.score === 'number'
      ? source.score
      : typeof source.risk_score === 'number'
        ? source.risk_score
        : undefined;

  return { summary, riskLevel, risks, score };
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ContractStatus,
  { label: string; className: string }
> = {
  pending: {
    label: '待审核',
    className:
      'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-900',
  },
  processing: {
    label: '审核中',
    className:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900',
  },
  done: {
    label: '已完成',
    className:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900',
  },
  error: {
    label: '失败',
    className:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900',
  },
};

function StatusBadge({ status }: { status: ContractStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn('font-medium', cfg.className)}>
      {status === 'processing' && <Spinner className="w-3 h-3" />}
      {status === 'done' && <CheckCircle className="w-3 h-3" />}
      {status === 'error' && <AlertTriangle className="w-3 h-3" />}
      {status === 'pending' && <Clock className="w-3 h-3" />}
      {cfg.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Risk card
// ---------------------------------------------------------------------------

const RISK_CONFIG: Record<
  RiskSeverity,
  {
    label: string;
    badgeClass: string;
    cardClass: string;
    iconClass: string;
  }
> = {
  high: {
    label: '高风险',
    badgeClass:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900',
    cardClass:
      'border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20',
    iconClass: 'text-red-500',
  },
  medium: {
    label: '中风险',
    badgeClass:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900',
    cardClass:
      'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20',
    iconClass: 'text-amber-500',
  },
  low: {
    label: '低风险',
    badgeClass:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900',
    cardClass:
      'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20',
    iconClass: 'text-emerald-500',
  },
};

function RiskCard({ risk, index }: { risk: RiskItem; index: number }) {
  const cfg = RISK_CONFIG[risk.severity] ?? RISK_CONFIG.low;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-shadow hover:shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300',
        cfg.cardClass
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 flex-shrink-0', cfg.iconClass)}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn('font-medium', cfg.badgeClass)}>
              {cfg.label}
            </Badge>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {risk.category}
            </h4>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {risk.description}
          </p>
          {risk.clause && (
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 rounded-md px-3 py-1.5 border border-slate-200 dark:border-slate-700">
              <span className="font-medium">相关条款：</span>
              {risk.clause}
            </div>
          )}
          {risk.suggestion && (
            <div className="flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
              <div>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">修改建议：</span>
                <span>{risk.suggestion}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login prompt (for non-authenticated users)
// ---------------------------------------------------------------------------

function LoginPrompt() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center py-10">
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Shield className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              合同审核需要登录
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              请登录后使用 AI 合同审核功能。系统将对您的合同进行全面风险分析，生成专业审核报告。
            </p>
          </div>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
            onClick={() => {
              const event = new CustomEvent('open-auth-modal');
              window.dispatchEvent(event);
            }}
          >
            <LogIn className="w-4 h-4" />
            登录 / 注册
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload zone
// ---------------------------------------------------------------------------

interface UploadZoneProps {
  onFile: (file: File) => void;
  uploading: boolean;
}

function UploadZone({ onFile, uploading }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (uploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile, uploading]
  );

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = ''; // reset so the same file can be re-selected
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 lg:p-10 cursor-pointer transition-all duration-200',
        dragOver
          ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 scale-[1.01]'
          : 'border-slate-300 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-900/50',
        uploading && 'pointer-events-none opacity-60'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleSelect}
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
              : '拖拽合同文件到此处，或点击选择文件'}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          支持 PDF、DOCX、TXT 格式，文件大小不超过 {formatFileSize(MAX_FILE_SIZE)}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Audit() {
  const { user } = useAuth();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [auditingId, setAuditingId] = useState<number | null>(null);
  const [auditErrors, setAuditErrors] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, AuditResult>>({});

  // Track active polling so it can be cancelled on unmount / retry
  const pollingRef = useRef<boolean>(true);
  // Load existing contracts from API on mount/re-mount
  useEffect(() => {
    if (!user) return;
    api.history().then((res: any) => {
      if (res?.code === 0 && res.data?.contracts) {
        setContracts(res.data.contracts.map((c: any) => ({
          id: c.id,
          filename: c.filename,
          fileSize: 0,
          uploadedAt: new Date(c.created_at || Date.now()),
          status: c.status === 'audited' ? 'done' : c.status === 'auditing' ? 'processing' : 'pending',
        })));
      }
    }).catch(() => {});
  }, [user]);


  // -------------------------------------------------------------------------
  // File upload handler
  // -------------------------------------------------------------------------

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null);

      if (!isValidFile(file)) {
        setUploadError('不支持的文件格式，请上传 PDF、DOCX 或 TXT 文件。');
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`文件大小超过限制（最大 ${formatFileSize(MAX_FILE_SIZE)}）。`);
        return;
      }

      setUploading(true);
      try {
        const res = await api.uploadContract(file);
        const r = res as { code?: number; data?: unknown; msg?: string };

        if (r?.code !== 0) {
          throw new Error(r?.msg || '上传失败，请重试。');
        }

        const data = (r.data ?? {}) as Record<string, unknown>;
        const id =
          typeof data.id === 'number'
            ? data.id
            : typeof data.contract_id === 'number'
              ? data.contract_id
              : typeof data.cid === 'number'
                ? data.cid
                : Date.now();

        const newContract: Contract = {
          id,
          filename:
            (typeof data.filename === 'string' && data.filename) ||
            (typeof data.name === 'string' && data.name) ||
            file.name,
          fileSize:
            typeof data.size === 'number' ? data.size : file.size,
          uploadedAt: new Date(),
          status: 'pending',
        };

        setContracts((prev) => [newContract, ...prev]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '上传失败，请重试。';
        setUploadError(msg);
      } finally {
        setUploading(false);
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // Audit handler — calls auditContract, then polls contractStatus if the
  // backend indicates async processing.
  // -------------------------------------------------------------------------

  const handleAudit = useCallback(
    async (contractId: number) => {
      setAuditingId(contractId);
      setUploadError(null);
      pollingRef.current = true;
      setAuditErrors((prev) => {
        const next = { ...prev };
        delete next[contractId];
        return next;
      });

      // Optimistically mark as processing
      setContracts((prev) =>
        prev.map((c) =>
          c.id === contractId ? { ...c, status: 'processing' as ContractStatus } : c
        )
      );

      try {
        const res = await api.auditContract(contractId);
        const result = parseAuditResult(res);

        // Determine whether the response contains real results or just
        // kicked off an async job. If risks were found or the summary is
        // non-generic, we can display immediately. Otherwise, poll.
        const hasImmediateResults =
          result.risks.length > 0 ||
          (result.summary !== '审核完成。' &&
            result.summary !== '审核完成，未返回详细结果。');

        if (hasImmediateResults) {
          setResults((prev) => ({ ...prev, [contractId]: result }));
          setContracts((prev) =>
            prev.map((c) =>
              c.id === contractId ? { ...c, status: 'done' as ContractStatus } : c
            )
          );
        } else {
          // Poll contractStatus until the audit completes
          const maxAttempts = 15; // 30 s at 2 s intervals
          let settled = false;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (!pollingRef.current) return; // cancelled

            await new Promise((r) => setTimeout(r, 2000));
            if (!pollingRef.current) return; // cancelled during wait

            try {
              const statusRes = await api.contractStatus(contractId);
              const sr = statusRes as { code?: number; data?: unknown };
              if (sr?.code === 0 && sr.data) {
                const sd = sr.data as Record<string, unknown>;
                const rawStatus = String(sd.status ?? sd.state ?? '').toLowerCase();

                if (
                  rawStatus === 'done' ||
                  rawStatus === 'completed' ||
                  rawStatus === 'audited' ||
                  rawStatus === 'finished'
                ) {
                  // Audit complete — extract results from the status payload
                  const polledResult = parseAuditResult(statusRes);
                  setResults((prev) => ({ ...prev, [contractId]: polledResult }));
                  setContracts((prev) =>
                    prev.map((c) =>
                      c.id === contractId
                        ? { ...c, status: 'done' as ContractStatus }
                        : c
                    )
                  );
                  settled = true;
                  break;
                }

                if (rawStatus === 'error' || rawStatus === 'failed') {
                  throw new Error(
                    typeof sd.error === 'string' ? sd.error : '审核处理失败'
                  );
                }
              }
            } catch {
              // Individual poll errors are non-fatal; keep trying
            }
          }

          if (!settled && pollingRef.current) {
            throw new Error('审核超时，请稍后重试或下载报告查看。');
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '审核失败，请重试。';
        setAuditErrors((prev) => ({ ...prev, [contractId]: msg }));
        setContracts((prev) =>
          prev.map((c) =>
            c.id === contractId ? { ...c, status: 'error' as ContractStatus } : c
          )
        );
      } finally {
        setAuditingId(null);
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // Retry handler
  // -------------------------------------------------------------------------

  const handleRetry = useCallback(
    (contractId: number) => {
      pollingRef.current = false; // cancel any in-flight polling
      setContracts((prev) =>
        prev.map((c) =>
          c.id === contractId ? { ...c, status: 'pending' as ContractStatus } : c
        )
      );
      setAuditErrors((prev) => {
        const next = { ...prev };
        delete next[contractId];
        return next;
      });
    },
    []
  );

  // -------------------------------------------------------------------------
  // Remove contract from local list
  // -------------------------------------------------------------------------

  const handleRemove = useCallback((contractId: number) => {
    setContracts((prev) => prev.filter((c) => c.id !== contractId));
    setResults((prev) => {
      const next = { ...prev };
      delete next[contractId];
      return next;
    });
    setAuditErrors((prev) => {
      const next = { ...prev };
      delete next[contractId];
      return next;
    });
  }, []);
const handleViewRisk = useCallback(    async (contractId: number) => {      try {        const res = await api.contractRisks(contractId);        const r = res as { code?: number; data?: unknown };        if (r?.code === 0 && r.data) {          const result = parseAuditResult(res);          setResults((prev) => ({ ...prev, [contractId]: result }));          setContracts((prev) =>            prev.map((c) =>              c.id === contractId ? { ...c, status: "done" as ContractStatus } : c            )          );        }      } catch {}    },    []  );

  // -------------------------------------------------------------------------
  // Scroll to results when a new audit completes
  // -------------------------------------------------------------------------

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Object.keys(results).length > 0) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [results]);

  // Cancel any in-flight polling when the component unmounts
  useEffect(() => {
    return () => {
      pollingRef.current = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Guard: non-logged-in users
  // -------------------------------------------------------------------------

  if (!user) {
    return <LoginPrompt />;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const hasContracts = contracts.length > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/25">
          <FileSearch className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">合同审核</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            上传合同文件，AI 自动识别风险条款并生成审核报告
          </p>
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>上传失败</AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      {/* Upload zone */}
      <Card className="py-0">
        <CardContent className="p-4 lg:p-6">
          <UploadZone onFile={handleFile} uploading={uploading} />
        </CardContent>
      </Card>

      {/* Contract list */}
      {hasContracts && (
        <Card className="py-0">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-indigo-500" />
              已上传合同
              <Badge variant="secondary" className="ml-1">
                {contracts.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              点击「审核」按钮对合同进行 AI 风险分析
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableHead className="pl-4 lg:pl-6">文件名</TableHead>
                  <TableHead className="hidden sm:table-cell">大小</TableHead>
                  <TableHead className="hidden md:table-cell">上传时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right pr-4 lg:pr-6">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => {
                  const isAuditing = auditingId === contract.id;

                  return (
                    <TableRow key={contract.id}>
                      {/* Filename */}
                      <TableCell className="pl-4 lg:pl-6">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex-shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[160px] lg:max-w-xs">
                            {contract.filename}
                          </span>
                        </div>
                      </TableCell>

                      {/* File size */}
                      <TableCell className="hidden sm:table-cell text-sm text-slate-500 dark:text-slate-400">
                        {formatFileSize(contract.fileSize)}
                      </TableCell>

                      {/* Upload time */}
                      <TableCell className="hidden md:table-cell text-sm text-slate-500 dark:text-slate-400">
                        {formatTime(contract.uploadedAt)}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={contract.status} />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right pr-4 lg:pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Audit / Retry button */}
                          {(contract.status === 'pending' ||
                            contract.status === 'error') && (
                            <Button
                              size="sm"
                              onClick={() =>
                                contract.status === 'error'
                                  ? handleRetry(contract.id)
                                  : handleAudit(contract.id)
                              }
                              disabled={isAuditing}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                              {isAuditing ? (
                                <>
                                  <Spinner className="w-3.5 h-3.5" />
                                  审核中
                                </>
                              ) : contract.status === 'error' ? (
                                '重试'
                              ) : (
                                <>
                                  <Shield className="w-3.5 h-3.5" />
                                  审核
                                </>
                              )}
                            </Button>
                          )}

                          {/* Processing indicator */}
                          {contract.status === 'processing' && !isAuditing && (
                            <span className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400">
                              <Spinner className="w-3.5 h-3.5" />
                              处理中
                            </span>
                          )}

                          {/* Download report */}
                          {contract.status === 'done' && (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                            >
                              <a
                                href={api.downloadDocx(contract.id)}
                                download
                                className="border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Download className="w-3.5 h-3.5" />
                                下载报告
                              </a>
                            </Button>
                          )}

                          {/* Remove button */}
                          {!isAuditing && (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => handleRemove(contract.id)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label="移除"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {/* View risks */}
                          {contract.status === 'done' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewRisk(contract.id)}
                              className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                            >
                              <FileSearch className="w-3.5 h-3.5" />
                              查看风险
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Per-contract audit error (inline under the table) */}
            {Object.entries(auditErrors).length > 0 && (
              <div className="p-4 space-y-2">
                {Object.entries(auditErrors).map(([id, msg]) => (
                  <Alert key={id} variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle>审核失败</AlertTitle>
                    <AlertDescription>{msg}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state hint when no contracts yet */}
      {!hasContracts && !uploading && (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              暂无上传的合同
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              上传合同文件后即可开始 AI 审核
            </p>
          </CardContent>
        </Card>
      )}

      {/* Audit results */}
      <div ref={resultsRef}>
        {Object.entries(results).map(([idStr, result]) => {
          const contract = contracts.find((c) => c.id === Number(idStr));
          if (!contract) return null;

          return (
            <Card key={idStr} className="mb-4 last:mb-0">
              <CardHeader className="border-b border-slate-200 dark:border-slate-800">
                <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="flex items-center gap-2 text-base">
                    <FileSearch className="w-4 h-4 text-indigo-500" />
                    审核报告 — {contract.filename}
                  </span>
                  <div className="flex items-center gap-2">
                    {result.score != null && (
                      <Badge variant="outline" className="font-medium">
                        风险评分：{result.score}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-medium',
                        RISK_CONFIG[result.riskLevel].badgeClass
                      )}
                    >
                      <Shield className="w-3 h-3" />
                      {RISK_CONFIG[result.riskLevel].label}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Summary */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500" />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                        总体评估
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {result.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Risk items */}
                {result.risks.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      发现 {result.risks.length} 个风险点
                    </h4>
                    {result.risks.map((risk, idx) => (
                      <RiskCard key={idx} risk={risk} index={idx} />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 p-4">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                      未发现明显风险条款，合同整体风险较低。
                    </p>
                  </div>
                )}

                {/* Download bar */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    审核完成于 {formatTime(new Date())}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <a href={api.downloadDocx(contract.id)} download>
                      <Download className="w-3.5 h-3.5" />
                      下载 DOCX 报告
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
