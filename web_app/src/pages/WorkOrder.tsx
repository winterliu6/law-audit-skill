import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  ClipboardList,
  Loader2,
  CheckCircle,
  Undo2,
  AlertCircle,
  Calendar,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLES: Record<string, string> = {
  csr: '客服',
  law: '法务',
  audit: '审核',
  sort: '归档',
  kb: '知识库',
};

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'orange' },
  processing: { label: '处理中', color: 'blue' },
  done: { label: '已完成', color: 'green' },
  returned: { label: '已退回', color: 'gray' },
};

type OrderStatus = 'pending' | 'processing' | 'done' | 'returned';
type FilterStatus = OrderStatus | 'all';

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'processing', label: '处理中' },
  { key: 'done', label: '已完成' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkOrder {
  id: number;
  title: string;
  description: string;
  status: OrderStatus;
  role: string;
  created_at: string;
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

function statusBadgeColor(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    pending: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800',
    processing: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
    done: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
    returned: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  };
  return map[status] || map.pending;
}

function apiStatusToOrderStatus(s: string): OrderStatus {
  if (s === 'pending' || s === 'processing' || s === 'done' || s === 'returned') return s;
  return 'pending';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PromptDialogProps {
  open: boolean;
  title: string;
  description: string;
  placeholder: string;
  confirmLabel: string;
  loading: boolean;
  onConfirm: (text: string) => void;
  onClose: () => void;
}

function PromptDialog({
  open,
  title,
  description,
  placeholder,
  confirmLabel,
  loading,
  onConfirm,
  onClose,
}: PromptDialogProps) {
  const [text, setText] = useState('');

  const handleConfirm = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onConfirm(trimmed);
    setText('');
  };

  const handleClose = () => {
    if (loading) return;
    setText('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!text.trim() || loading}>
            {loading && <Spinner className="w-4 h-4" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function WorkOrderSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mb-5">
        <ClipboardList className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
        暂无工单
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
        当前筛选条件下没有工单，试试切换其他分类查看。
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
        <Undo2 className="w-4 h-4" />
        重试
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkOrderCard
// ---------------------------------------------------------------------------

interface WorkOrderCardProps {
  order: WorkOrder;
  onAction: () => void;
}

function WorkOrderCard({ order, onAction }: WorkOrderCardProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [dialog, setDialog] = useState<'complete' | 'return' | null>(null);

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await api.acceptOrder(order.id);
      onAction();
    } catch {
      // handled by parent error boundary
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (result: string) => {
    setActionLoading(true);
    try {
      await api.completeOrder(order.id, result);
      setDialog(null);
      onAction();
    } catch {
      // handled by parent error boundary
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async (reason: string) => {
    setActionLoading(true);
    try {
      await api.returnOrder(order.id, reason);
      setDialog(null);
      onAction();
    } catch {
      // handled by parent error boundary
    } finally {
      setActionLoading(false);
    }
  };

  const status = STATUS[order.status] || STATUS.pending;
  const roleLabel = ROLES[order.role] || order.role;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-base">{order.title}</CardTitle>
            <Badge
              variant="outline"
              className={cn('flex-shrink-0 text-xs', statusBadgeColor(order.status))}
            >
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {order.description || '暂无描述'}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-500 pt-1.5">
            <span className="inline-flex items-center gap-1">
              <span className="font-medium">角色:</span> {roleLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(order.created_at)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3">
            {order.status === 'pending' && (
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={actionLoading}
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <CheckCircle className="w-3.5 h-3.5" />
                接单
              </Button>
            )}
            {order.status === 'processing' && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setDialog('complete')}
                  disabled={actionLoading}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  完成
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialog('return')}
                  disabled={actionLoading}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  退回
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Complete dialog */}
      <PromptDialog
        open={dialog === 'complete'}
        title="完成工单"
        description="请输入处理结果说明"
        placeholder="输入处理结果..."
        confirmLabel="确认完成"
        loading={actionLoading}
        onConfirm={handleComplete}
        onClose={() => setDialog(null)}
      />

      {/* Return dialog */}
      <PromptDialog
        open={dialog === 'return'}
        title="退回工单"
        description="请输入退回原因"
        placeholder="输入退回原因..."
        confirmLabel="确认退回"
        loading={actionLoading}
        onConfirm={handleReturn}
        onClose={() => setDialog(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkOrder() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = filter === 'all' ? undefined : filter;
      const res = await api.workorders(statusParam) as { code?: number; data?: unknown };
      if (res?.code === 0 && Array.isArray(res.data)) {
        const mapped: WorkOrder[] = (res.data as Array<Record<string, unknown>>).map((item) => ({
          id: item.id as number,
          title: (item.title as string) || '',
          description: (item.description as string) || '',
          status: apiStatusToOrderStatus((item.status as string) || ''),
          role: (item.role as string) || '',
          created_at: (item.created_at as string) || '',
        }));
        setOrders(mapped);
      } else {
        setOrders([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载工单失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
          登录后即可查看和管理工单。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/25">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">工单管理</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            管理和处理法务工单
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150',
              filter === f.key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <WorkOrderSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchOrders} />
      ) : orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <WorkOrderCard
              key={order.id}
              order={order}
              onAction={fetchOrders}
            />
          ))}
        </div>
      )}
    </div>
  );
}
