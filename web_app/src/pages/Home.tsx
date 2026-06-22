import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth, getGuestToken } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { Send, Bot, User, Scale, AlertCircle, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the answer text from an API response. The backend may return the
 * text in several shapes ({ data: "…" }, { data: { answer: "…" } }, etc.)
 * so we try the common keys before falling back to a generic message.
 */
function extractAnswer(res: Record<string, unknown> | null | undefined): string {
  if (!res) return '抱歉，未收到有效回复。';

  const code = (res as { code?: number }).code;
  if (code === 0) {
    const data = (res as { data?: unknown }).data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      for (const key of ['answer', 'reply', 'response', 'content', 'message', 'result', 'text']) {
        if (typeof obj[key] === 'string') return obj[key] as string;
      }
    }
  }

  const fallback = (res as { msg?: string; detail?: string; message?: string });
  return fallback.msg || fallback.detail || fallback.message || '抱歉，服务暂时不可用，请稍后重试。';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

const SUGGESTED_QUESTIONS = [
  '劳动合同解除的法定条件有哪些？',
  '公司股权转让需要哪些法律文件？',
  '商业秘密保护的法律措施是什么？',
  '房屋租赁合同需要注意哪些条款？',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="AI 正在输入">
      <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0',
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble + timestamp */}
      <div className={cn('flex flex-col gap-1 max-w-[78%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm',
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
          )}
        >
          {message.content}
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestRemaining, setGuestRemaining] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGuest = !user;

  // Auto-scroll to bottom on new messages or when loading state changes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sending]);

  // Fetch guest consultation remaining count
  useEffect(() => {
    if (!isGuest) {
      setGuestRemaining(null);
      return;
    }
    const token = getGuestToken();
    let cancelled = false;
    api
      .guestConsultCount(token)
      .then((res: unknown) => {
        if (cancelled) return;
        const r = res as { code?: number; data?: unknown };
        if (r?.code === 0 && r.data != null) {
          if (typeof r.data === 'number') {
            setGuestRemaining(r.data);
          } else if (typeof r.data === 'object' && r.data !== null) {
            const d = r.data as Record<string, unknown>;
            if (typeof d.remaining === 'number') setGuestRemaining(d.remaining);
            else if (typeof d.count === 'number') setGuestRemaining(d.count);
            else if (typeof d.limit === 'number' && typeof d.used === 'number') {
              setGuestRemaining(d.limit - d.used);
            }
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || sending) return;

    setError(null);

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      let res: unknown;
      if (isGuest) {
        const token = getGuestToken();
        res = await api.guestConsultation(question, token);
      } else {
        res = await api.consultation(question);
      }

      const answer = extractAnswer(res as Record<string, unknown> | null);
      const aiMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'ai',
        content: answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Update remaining count from response if available
      if (isGuest) {
        const r = res as { data?: unknown };
        if (r?.data && typeof r.data === 'object') {
          const d = r.data as Record<string, unknown>;
          if (typeof d.remaining === 'number') setGuestRemaining(d.remaining);
          else if (typeof d.count === 'number') setGuestRemaining(d.count);
          else if (guestRemaining != null && guestRemaining > 0) {
            setGuestRemaining(guestRemaining - 1);
          }
        } else if (guestRemaining != null && guestRemaining > 0) {
          setGuestRemaining(guestRemaining - 1);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '咨询请求失败，请稍后重试。';
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [input, sending, isGuest, guestRemaining]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (q: string) => {
    setInput(q);
    textareaRef.current?.focus();
  };

  const canSend = input.trim().length > 0 && !sending;
  const showWelcome = messages.length === 0 && !sending;

  return (
    <div className="flex h-[calc(100vh-6rem)] lg:h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/25">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">法务智能咨询</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isGuest ? '游客模式' : `已登录 · ${user?.username}`}
              {isGuest && guestRemaining != null && ` · 剩余 ${guestRemaining} 次咨询`}
            </p>
          </div>
        </div>
      </div>

      {/* Chat card */}
      <Card className="flex-1 flex flex-col overflow-hidden p-0 gap-0 min-h-0 shadow-md">
        {/* Messages scroll area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 min-h-0"
        >
          {showWelcome ? (
            /* Welcome / empty state */
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-xl shadow-indigo-500/30 mb-5">
                <Scale className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                欢迎使用法务智能咨询
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
                我是您的 AI 法务助手，可以为您解答劳动合同、合同纠纷、知识产权等法律问题。
                {isGuest && ' 游客模式下每日有咨询次数限制，注册登录可获取更多额度。'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-150"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message list */
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}

          {/* Loading / typing indicator */}
          {sending && (
            <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        {/* Error bar */}
        {error && (
          <div className="px-4 lg:px-6 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-900">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                aria-label="关闭错误提示"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 lg:p-4 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的法律问题…（Enter 发送，Shift+Enter 换行）"
              rows={1}
              className="min-h-[44px] max-h-32 resize-none bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus-visible:border-indigo-400 focus-visible:ring-indigo-100 dark:focus-visible:ring-indigo-950"
              disabled={sending}
            />
            <Button
              onClick={handleSend}
              disabled={!canSend}
              size="icon"
              className="h-[44px] w-[44px] rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 disabled:opacity-40 flex-shrink-0"
              aria-label="发送消息"
            >
              {sending ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 px-1">
            AI 生成内容仅供参考，不构成正式法律意见。
          </p>
        </div>
      </Card>
    </div>
  );
}
