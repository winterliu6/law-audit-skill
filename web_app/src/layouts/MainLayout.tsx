import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import {
  MessageSquare, FileSearch, LayoutDashboard, History,
  FileText, Shield, Menu, X, LogOut, User, Scale,
  Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '法务仪表盘' },
  { to: '/', icon: MessageSquare, label: '法务咨询' },
  { to: '/audit', icon: FileSearch, label: '合同审核' },
  { to: '/contract-template', icon: FileText, label: '合同生成' },
  { to: '/history', icon: History, label: '历史记录' },
  { to: '/admin', icon: Shield, label: '后台管理' },
];

export default function MainLayout() {
  const { user, loading, login, register, logout, modelInfo } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login');
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [regCompany, setRegCompany] = useState('');
  const [regDept, setRegDept] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [orgs, setOrgs] = useState<any>(null);

  const loadOrgs = async () => {
    try { const r = await api.orgOptions(); if (r.code === 0) setOrgs(r.data); } catch {}
  };

  const handleAuth = async () => {
    if (!authUser.trim() || !authPass.trim()) { setAuthError('请输入用户名和密码'); return; }
    setAuthBusy(true); setAuthError('');
    try { await login(authUser, authPass); setAuthOpen(false); setAuthUser(''); setAuthPass(''); }
    catch (e: any) { setAuthError(e.message || '登录失败'); }
    finally { setAuthBusy(false); }
  };

  const handleRegister = async () => {
    if (!regCompany || !regDept || !regFullName || !authUser.trim() || !authPass.trim()) { setAuthError('请填写所有必填项'); return; }
    setAuthBusy(true); setAuthError('');
    try {
      await register({ username: authUser, password: authPass, company: regCompany, department: regDept, full_name: regFullName });
      setAuthError('注册成功，请登录'); setAuthTab('login'); setAuthPass('');
    } catch (e: any) { setAuthError(e.message || '注册失败'); }
    finally { setAuthBusy(false); }
  };

  const handleLogout = async () => { await logout(); navigate('/'); };

  // Listen for auth modal trigger from child pages
  useEffect(() => {
    const handler = () => setAuthOpen(true);
    window.addEventListener('open-auth-modal', handler);
    return () => window.removeEventListener('open-auth-modal', handler);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6">
          <div className="flex items-center h-16 gap-4">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20">
                <Scale className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">法务审核系统</h1>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Law Audit System</p>
              </div>
            </div>
            <nav className="hidden lg:flex items-center gap-1 flex-1 ml-4">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to}
                  className={({ isActive }) => `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${isActive ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <item.icon className="w-4 h-4" />{item.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-3 ml-auto flex-shrink-0">
              {modelInfo && (
                <Badge variant="outline" className="hidden sm:inline-flex text-xs font-normal gap-1.5 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">{modelInfo.model}</Badge>
              )}
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold text-xs">{user.username[0]?.toUpperCase() || 'U'}</div>
                  <span className="hidden sm:inline text-sm text-slate-700 dark:text-slate-300 font-medium">{user.username}</span>
                  <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"><LogOut className="w-4 h-4" /></button>
                </div>
              ) : (
                <Button size="sm" onClick={() => { setAuthOpen(true); loadOrgs(); }} className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-sm shadow-indigo-500/20"><User className="w-4 h-4 mr-1.5" />登录 / 注册</Button>
              )}
              <button className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
                {mobileNavOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
              </button>
            </div>
          </div>
          {mobileNavOpen && (
            <div className="lg:hidden pb-3 border-t border-slate-100 dark:border-slate-800 mt-1 pt-2">
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <item.icon className="w-4.5 h-4.5" />{item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 w-full max-w-screen-2xl mx-auto p-4 lg:p-8"><Outlet /></main>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-center"><div className="flex items-center justify-center gap-2"><Scale className="w-5 h-5 text-indigo-600" />法务审核系统</div></DialogTitle></DialogHeader>
          <Tabs value={authTab} onValueChange={setAuthTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="login">登录</TabsTrigger><TabsTrigger value="register">注册</TabsTrigger></TabsList>
            {authError && (<div className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${authError.includes('成功') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'}`}><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{authError}</div>)}
            <TabsContent value="login" className="mt-4 space-y-4">
              <div className="space-y-2"><Label>用户名</Label><Input value={authUser} onChange={(e) => setAuthUser(e.target.value)} placeholder="请输入用户名" onKeyDown={(e) => e.key === 'Enter' && handleAuth()} /></div>
              <div className="space-y-2"><Label>密码</Label><Input type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} placeholder="请输入密码" onKeyDown={(e) => e.key === 'Enter' && handleAuth()} /></div>
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleAuth} disabled={authBusy}>{authBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}登 录</Button>
            </TabsContent>
            <TabsContent value="register" className="mt-4 space-y-4">
              <div className="space-y-2"><Label>公司</Label><select className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm" value={regCompany} onChange={(e) => setRegCompany(e.target.value)}><option value="">选择公司</option>{orgs?.companies?.map((c: any) => (<option key={c.id} value={c.name}>{c.name}</option>))}</select></div>
              <div className="space-y-2"><Label>部门</Label><select className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm" value={regDept} onChange={(e) => setRegDept(e.target.value)}><option value="">选择部门</option>{orgs?.departments?.map((d: any) => (<option key={d.id} value={d.name}>{d.name}</option>))}</select></div>
              <div className="space-y-2"><Label>姓名</Label><Input value={regFullName} onChange={(e) => setRegFullName(e.target.value)} placeholder="请输入姓名" /></div>
              <div className="space-y-2"><Label>用户名（字母+数字，4-20位）</Label><Input value={authUser} onChange={(e) => setAuthUser(e.target.value)} placeholder="请输入用户名" /></div>
              <div className="space-y-2"><Label>密码（6位以上，含字母+数字）</Label><Input type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} placeholder="请输入密码" /></div>
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleRegister} disabled={authBusy}>{authBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}注 册</Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
