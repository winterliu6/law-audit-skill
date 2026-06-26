import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  FileText, FileSearch, AlertTriangle, MessageSquare,
  TrendingUp, Clock, ArrowRight, Scale, Upload,
  Shield, Activity, PieChart, BarChart3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const typeIcons: Record<string, any> = {
  upload: Upload, audit: FileSearch, audit_done: Shield, consult: MessageSquare,
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.dashboard().then((res: any) => {
      if (res?.code === 0) setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const goto = (path: string) => navigate(path);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center py-10 shadow-lg border-indigo-100">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100">
              <Scale className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">请登录后查看仪表盘</h2>
            <p className="text-sm text-slate-500">登录后可查看合同审核统计与法务工作概览</p>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
              onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}>
              登录 / 注册
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner className="w-8 h-8 text-indigo-600" /></div>;
  }

  const d = data || {};
  const hrc = d.high_risk_contracts || 0;
  const aud = d.audited_contracts || 0;
  const pen = d.pending_contracts || 0;
  const tot = d.total_contracts || 1;

  return (
    <div className="space-y-6">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
            <Activity className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">法务仪表盘</h2>
            <p className="text-xs text-slate-500">合同审核与法务工作数据总览</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => api.dashboard().then((r: any) => r?.code === 0 && setData(r.data))}
          className="text-xs border-slate-300">
          <BarChart3 className="w-3.5 h-3.5 mr-1" />刷新数据
        </Button>
      </div>

      {/* ===== Row 1: 5 Key Stats ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: '合同总数', value: tot, icon: FileText, color: 'indigo', path: '/audit', desc: '全部合同' },
          { label: '已审核', value: aud, icon: Shield, color: 'emerald', path: '/history', desc: '完成AI分析' },
          { label: '高风险', value: hrc, icon: AlertTriangle, color: 'red', path: '/audit', desc: '含高风险条款' },
          { label: '待处理', value: pen, icon: Clock, color: 'amber', path: '/audit', desc: '等待审核' },
          { label: '法务咨询', value: d.total_consultations || 0, icon: MessageSquare, color: 'blue', path: '/', desc: 'AI问答次数' },
        ].map((s) => (
          <div key={s.label} onClick={() => goto(s.path)} className="cursor-pointer group">
            <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-t-4 overflow-hidden"
              style={{ borderTopColor: { indigo: '#6366f1', emerald: '#10b981', red: '#ef4444', amber: '#f59e0b', blue: '#3b82f6' }[s.color] }}>
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className={'p-2 rounded-xl ' + {
                    indigo: 'bg-indigo-100 text-indigo-600',
                    emerald: 'bg-emerald-100 text-emerald-600',
                    red: 'bg-red-100 text-red-600',
                    amber: 'bg-amber-100 text-amber-600',
                    blue: 'bg-blue-100 text-blue-600',
                  }[s.color]}>
                    <s.icon className="w-4.5 h-4.5" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{s.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{s.desc}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* ===== Row 2: Risk Overview + Monthly Trend ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk overview bar */}
        <Card className="overflow-hidden">
          <CardHeader className="py-3 border-b border-slate-100">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-500" />
              风险概览
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex gap-1 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 p-0.5">
              {(hrc > 0) && <div style={{ width: ((hrc/tot)*100)+'%' }} className="bg-red-500 rounded-full min-w-[8px] transition-all duration-500" />}
              {((aud-hrc) > 0) && <div style={{ width: (((aud-hrc)/tot)*100)+'%' }} className="bg-emerald-500 rounded-full min-w-[8px] transition-all duration-500" />}
              {(pen > 0) && <div style={{ width: ((pen/tot)*100)+'%' }} className="bg-slate-300 dark:bg-slate-600 rounded-full min-w-[8px] transition-all duration-500" />}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { label: '高风险', count: hrc, color: 'bg-red-500', pct: tot > 0 ? Math.round(hrc/tot*100) : 0 },
                { label: '已审核', count: aud, color: 'bg-emerald-500', pct: tot > 0 ? Math.round(aud/tot*100) : 0 },
                { label: '待处理', count: pen, color: 'bg-slate-400', pct: tot > 0 ? Math.round(pen/tot*100) : 0 },
              ].map((item) => (
                <div key={item.label} className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className={'w-3 h-3 rounded-full mx-auto mb-1.5 ' + item.color} />
                  <p className="text-lg font-bold text-slate-800">{item.count}</p>
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="text-[10px] text-slate-400">{item.pct}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly trend */}
        <Card className="overflow-hidden">
          <CardHeader className="py-3 border-b border-slate-100">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              月度审核趋势
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {(d.monthly || []).length > 0 ? (
              <div className="space-y-2">
                {(d.monthly || []).slice(-6).map((m: any, _i: number) => {
                  const maxVal = Math.max(...(d.monthly || []).map((x: any) => x.count), 1);
                  const pct = (m.count / maxVal) * 100;
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-16 flex-shrink-0">{m.month}</span>
                      <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: Math.max(pct, 4) + '%' }}>
                          <span className="text-[10px] text-white font-semibold drop-shadow-sm">{m.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-slate-400">暂无月度数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Row 3: Risk Types + Contract Types + Recent Activity ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk types */}
        <Card className="overflow-hidden">
          <CardHeader className="py-3 border-b border-slate-100">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              高频风险类型
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {(d.risk_types || []).length > 0 ? (
              <div className="space-y-2">
                {(d.risk_types || []).slice(0, 6).map((rt: any, i: number) => {
                  const maxR = Math.max(...(d.risk_types || []).map((x: any) => x.count), 1);
                  const colors = ['bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-purple-400', 'bg-emerald-400', 'bg-pink-400'];
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 w-24 truncate flex-shrink-0" title={rt.name}>{rt.name}</span>
                      <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={'h-full rounded-full ' + colors[i % 6]} style={{ width: (rt.count/maxR*100)+'%' }} />
                      </div>
                      <span className="text-xs text-slate-500 w-6 text-right">{rt.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-slate-400">暂无风险数据</div>
            )}
          </CardContent>
        </Card>

        {/* Contract types */}
        <Card className="overflow-hidden">
          <CardHeader className="py-3 border-b border-slate-100">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-500" />
              合同类型分布
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {(d.contract_types || []).length > 0 ? (
              <div className="flex items-center justify-center gap-6 py-2">
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                    {(d.contract_types || []).map((ct: any, i: number) => {
                      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#94a3b8'];
                      const total = (d.contract_types || []).reduce((s: number, x: any) => s + x.count, 0);
                      const pct = ct.count / total;
                      const r = 15.9;
                      const circ = 2 * Math.PI * r;
                      const offset = circ - pct * circ;
                      
                      return (
                        <circle key={ct.name} cx="18" cy="18" r={r} fill="none"
                          stroke={colors[i % colors.length]} strokeWidth="3"
                          strokeDasharray={`${circ}`}
                          strokeDashoffset={offset}
                          transform={`rotate(0, 18, 18)`}
                          style={{ transition: 'all 0.5s' }}
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-slate-800">{tot}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(d.contract_types || []).map((ct: any, i: number) => {
                    const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-purple-500', 'bg-slate-400'];
                    return (
                      <div key={ct.name} className="flex items-center gap-2">
                        <span className={'w-2.5 h-2.5 rounded-full ' + colors[i % colors.length]} />
                        <span className="text-xs text-slate-600">{ct.name}</span>
                        <span className="text-xs text-slate-400 ml-auto">{ct.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-slate-400">暂无合同数据</div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="overflow-hidden">
          <CardHeader className="py-3 border-b border-slate-100">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              最近动态
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(d.recent_activities || []).length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(d.recent_activities || []).slice(0, 8).map((act: any, i: number) => {
                  const Icon = typeIcons[act.type] || Activity;
                  const typeColors: Record<string, string> = {
                    upload: 'text-blue-500 bg-blue-50',
                    audit: 'text-amber-500 bg-amber-50',
                    audit_done: 'text-emerald-500 bg-emerald-50',
                    consult: 'text-purple-500 bg-purple-50',
                  };
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                      <div className={'p-1.5 rounded-lg ' + (typeColors[act.type] || 'text-slate-400 bg-slate-50')}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 truncate">{act.desc}</p>
                        <p className="text-[10px] text-slate-400">{act.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-slate-400">暂无动态</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Quick Actions ===== */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-100 dark:border-indigo-900">
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">快捷操作</p>
              <p className="text-xs text-slate-500">常用功能快速直达</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => goto('/audit')} className="bg-white dark:bg-slate-800 text-slate-700 border border-slate-300 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm">
              <Upload className="w-3.5 h-3.5 mr-1.5" />上传合同
            </Button>
            <Button size="sm" onClick={() => goto('/')} className="bg-white dark:bg-slate-800 text-slate-700 border border-slate-300 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />法务咨询
            </Button>
            <Button size="sm" onClick={() => goto('/history')} className="bg-white dark:bg-slate-800 text-slate-700 border border-slate-300 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm">
              <FileText className="w-3.5 h-3.5 mr-1.5" />历史记录
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
