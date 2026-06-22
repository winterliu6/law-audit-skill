import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  FileText,
  Clock,
  Download,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsultationRecord {
  id: number;
  question: string;
  answer: string;
  created_at: string;
}

interface ContractRecord {
  id: number;
  filename: string;
  status: string;
  created_at: string;
}

interface HistoryData {
  consultations: ConsultationRecord[];
  contracts: ContractRecord[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'orange' },
  processing: { label: '审核中', color: 'blue' },
  done: { label: '已完成', color: 'green' },
  error: { label: '异常', color: 'red' },
};

function contractStatusBadge(status: string) {
  const info = CONTRACT_STATUS[status] || { label: status || '未知', color: 'gray' };
  const colorMap: Record<string, string> = {
    orange: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800',
    blue: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
    green: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
    red: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
    gray: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  };
  return (
    <Badge variant="outline" className={cn('text-xs', colorMap[info.color] || colorMap.gray)}>
      {info.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function HistorySkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Consultations skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Contracts skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------

function ColumnEmpty({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-slate-300 dark:text-slate-600 mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
        {description}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-400 dark:text-red-500 mb-5">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
        加载失败
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed mb-5">
        {message}
      </p>
      <Button variant="outline" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consultation Item
// ---------------------------------------------------------------------------

function ConsultationItem({ item }: { item: ConsultationRecord }) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0 space-y-1.5">
      <div className="flex items-start gap-2">
        <MessageSquare className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
            {truncate(item.question, 120)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
            {truncate(item.answer, 150)}
          </p>
          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            <Clock className="w-3 h-3" />
            <span>{formatDate(item.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract Item
// ---------------------------------------------------------------------------

function ContractItem({ item }: { item: ContractRecord }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <FileText className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {item.filename}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {contractStatusBadge(item.status)}
            <span className="text-xs text-slate-400 dark:text-slate-500 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(item.created_at)}
            </span>
          </div>
        </div>
      </div>
      {item.status === 'done' && (
        <a
          href={api.downloadDocx(item.id)}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex-shrink-0 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          下载
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function History() {
  const { user } = useAuth();
  const [data, setData] = useState<HistoryData>({ consultations: [], contracts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.history() as { code?: number; data?: unknown };
      if (res?.code === 0 && res.data && typeof res.data === 'object') {
        const d = res.data as Record<string, unknown>;
        const consultations: ConsultationRecord[] = Array.isArray(d.consultations)
          ? (d.consultations as Array<Record<string, unknown>>).map((c) => ({
              id: c.id as number,
              question: (c.question as string) || '',
              answer: (c.answer as string) || '',
              created_at: (c.created_at as string) || '',
            }))
          : [];
        const contracts: ContractRecord[] = Array.isArray(d.contracts)
          ? (d.contracts as Array<Record<string, unknown>>).map((c) => ({
              id: c.id as number,
              filename: (c.filename as string) || '',
              status: (c.status as string) || '',
              created_at: (c.created_at as string) || '',
            }))
          : [];
        setData({ consultations, contracts });
      } else {
        setData({ consultations: [], contracts: [] });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载历史记录失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const isLoggedIn = !!user;

  // Guest gate
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-500 mb-5">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
          请先登录
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          登录后即可查看历史记录。
        </p>
      </div>
    );
  }

  // Loading
  if (loading) {
    return <HistorySkeleton />;
  }

  // Error
  if (error) {
    return <ErrorState message={error} onRetry={fetchHistory} />;
  }

  const { consultations, contracts } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-violet-500 text-white shadow-lg shadow-violet-500/25">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">历史记录</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            查看咨询与合同历史
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Consultations */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base inline-flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              咨询记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            {consultations.length === 0 ? (
              <ColumnEmpty
                icon={<MessageSquare className="w-8 h-8" />}
                title="暂无咨询记录"
                description="进行法律咨询后，记录将显示在这里"
              />
            ) : (
              <div className="space-y-0">
                {consultations.map((item) => (
                  <ConsultationItem key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Contracts */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base inline-flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              合同记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <ColumnEmpty
                icon={<FileText className="w-8 h-8" />}
                title="暂无合同记录"
                description="上传审核合同后，记录将显示在这里"
              />
            ) : (
              <div className="space-y-0">
                {contracts.map((item) => (
                  <ContractItem key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
