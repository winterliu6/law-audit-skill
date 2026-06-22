import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  FileText,
  Download,
  Plus,
  X,
  Loader2,
  Search,
  CheckCircle,
  LogIn,
  Shield,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldType = 'text' | 'number' | 'date' | 'textarea';

interface TemplateItem {
  id: number;
  name: string;
  category: string;
  description?: string;
  fields_count?: number;
}

interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  group?: string;
}

interface GenerateResult {
  download_url: string;
  filename?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fallback fields used when the API returns no auto-detected fields. */
const FALLBACK_FIELDS: TemplateField[] = [
  { key: 'party_a', label: '甲方名称', type: 'text', group: '合同主体' },
  { key: 'party_b', label: '乙方名称', type: 'text', group: '合同主体' },
  { key: 'party_a_addr', label: '甲方地址', type: 'text', group: '合同主体' },
  { key: 'party_b_addr', label: '乙方地址', type: 'text', group: '合同主体' },
  { key: 'contract_amount', label: '合同金额', type: 'number', group: '合同标的' },
  { key: 'start_date', label: '开始日期', type: 'date', group: '合同期限' },
  { key: 'end_date', label: '结束日期', type: 'date', group: '合同期限' },
  { key: 'payment_terms', label: '付款条款', type: 'textarea', group: '合同条款' },
  { key: 'remarks', label: '备注说明', type: 'textarea', group: '其他信息' },
];

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: '文本',
  number: '数字',
  date: '日期',
  textarea: '长文本',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupFields(fields: TemplateField[]): Map<string, TemplateField[]> {
  const groups = new Map<string, TemplateField[]>();
  for (const f of fields) {
    const g = f.group || '其他信息';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(f);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Login prompt
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
              合同模板生成需要登录
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              请登录后使用合同模板生成功能，系统将根据模板自动填充并生成可下载的合同文档。
            </p>
          </div>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
            onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))}
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
// Field input — renders the correct input element for a field type
// ---------------------------------------------------------------------------

interface FieldInputProps {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
  onRemove?: () => void;
  custom?: boolean;
}

function FieldInput({ field, value, onChange, onRemove, custom }: FieldInputProps) {
  const inputId = `field_${field.key}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {field.label}
          {custom && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 px-1.5">
              自定义
            </Badge>
          )}
        </Label>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-slate-400">
            {FIELD_TYPE_LABELS[field.type]}
          </Badge>
          {onRemove && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onRemove}
              className="text-slate-400 hover:text-red-500 h-5 w-5"
              aria-label={`移除字段 ${field.label}`}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      {field.type === 'textarea' ? (
        <Textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={`请输入${field.label}`}
          className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus-visible:border-indigo-400 focus-visible:ring-indigo-100 dark:focus-visible:ring-indigo-950"
        />
      ) : (
        <Input
          id={inputId}
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`请输入${field.label}`}
          className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus-visible:border-indigo-400 focus-visible:ring-indigo-100 dark:focus-visible:ring-indigo-950"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state for right panel
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 mb-4">
        <FileText className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
        选择一个合同模板
      </h3>
      <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
        从左侧列表中选择模板后，在此填写合同信息并生成合同文档
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ContractTemplate() {
  const { user } = useAuth();

  // --- List state ---
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Selected template state ---
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [customFields, setCustomFields] = useState<TemplateField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // --- Form state ---
  const [title, setTitle] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  // --- Custom field form ---
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');

  // --- Generate state ---
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  // -------------------------------------------------------------------------
  // Fetch categories
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    api
      .templateCategories()
      .then((res: unknown) => {
        if (cancelled) return;
        const r = res as { code?: number; data?: unknown };
        if (r?.code === 0) {
          let cats: string[] = [];
          if (Array.isArray(r.data)) {
            cats = r.data.map((c) =>
              typeof c === 'string' ? c : (c as Record<string, unknown>)?.name as string || (c as Record<string, unknown>)?.category as string || ''
            ).filter(Boolean);
          } else if (r.data && typeof r.data === 'object') {
            cats = Object.values(r.data).filter((v): v is string => typeof v === 'string');
          }
          setCategories(cats);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // -------------------------------------------------------------------------
  // Fetch templates (re-fetches when category changes)
  // -------------------------------------------------------------------------

  const fetchTemplates = useCallback(async (category: string) => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await api.templateList(category || undefined);
      const r = res as { code?: number; data?: unknown; msg?: string };
      if (r?.code === 0 && Array.isArray(r.data)) {
        setTemplates(
          r.data.map((item) => {
            const it = item as Record<string, unknown>;
            return {
              id: it.id as number,
              name: (it.name as string) || (it.template_name as string) || '未命名模板',
              category: (it.category as string) || '未分类',
              description: (it.description as string) || (it.desc as string) || '',
              fields_count: typeof it.fields_count === 'number' ? it.fields_count : typeof it.field_count === 'number' ? it.field_count : 0,
            };
          })
        );
      } else {
        setTemplates([]);
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : '加载模板列表失败');
      setTemplates([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates(selectedCategory);
  }, [selectedCategory, fetchTemplates]);

  // -------------------------------------------------------------------------
  // Select a template → fetch its fields
  // -------------------------------------------------------------------------

  const handleSelectTemplate = useCallback(async (template: TemplateItem) => {
    if (selectedId === template.id) return;

    setSelectedId(template.id);
    setSelectedTemplate(template);
    setTitle('');
    setValues({});
    setCustomFields([]);
    setResult(null);
    setGenerateError(null);
    setLoadingFields(true);

    try {
      const res = await api.templateFields(template.id);
      const r = res as { code?: number; data?: unknown };
      if (r?.code === 0 && Array.isArray(r.data) && r.data.length > 0) {
        const parsed: TemplateField[] = r.data.map((item) => {
          const it = item as Record<string, unknown>;
          const rawType = (it.type as string) || 'text';
          const type: FieldType =
            rawType === 'number' || rawType === 'date' || rawType === 'textarea'
              ? (rawType as FieldType)
              : 'text';
          return {
            key: (it.key as string) || (it.field_key as string) || (it.name as string) || '',
            label: (it.label as string) || (it.title as string) || (it.name as string) || (it.key as string) || '',
            type,
            group: (it.group as string) || (it.category as string) || undefined,
          };
        }).filter((f) => f.key);
        setFields(parsed);
      } else {
        // Fallback to default fields
        setFields(FALLBACK_FIELDS);
      }
    } catch {
      // Fallback to default fields on error
      setFields(FALLBACK_FIELDS);
    } finally {
      setLoadingFields(false);
    }
  }, [selectedId]);

  // -------------------------------------------------------------------------
  // Field value helpers
  // -------------------------------------------------------------------------

  const setFieldValue = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // -------------------------------------------------------------------------
  // Add custom field
  // -------------------------------------------------------------------------

  const handleAddCustomField = useCallback(() => {
    const key = newFieldKey.trim();
    const label = newFieldLabel.trim();
    if (!key || !label) return;

    // Avoid duplicate keys
    const allKeys = new Set([...fields.map((f) => f.key), ...customFields.map((f) => f.key)]);
    if (allKeys.has(key)) return;

    setCustomFields((prev) => [...prev, { key, label, type: newFieldType, group: '自定义字段' }]);
    setNewFieldKey('');
    setNewFieldLabel('');
    setNewFieldType('text');
  }, [newFieldKey, newFieldLabel, newFieldType, fields, customFields]);

  // -------------------------------------------------------------------------
  // Remove custom field
  // -------------------------------------------------------------------------

  const handleRemoveCustomField = useCallback((key: string) => {
    setCustomFields((prev) => prev.filter((f) => f.key !== key));
    setValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Generate contract
  // -------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!selectedId || !title.trim() || generating) return;

    setGenerating(true);
    setGenerateError(null);
    setResult(null);

    try {
      // Collect all non-empty field values
      const filledData: Record<string, string> = {};
      for (const f of [...fields, ...customFields]) {
        const val = values[f.key];
        if (val !== undefined && val !== '') {
          filledData[f.key] = val;
        }
      }

      const res = await api.generateContract({
        template_id: selectedId,
        filled_data: filledData,
        title: title.trim(),
      });
      const d = res as { code?: number; data?: Record<string, unknown>; msg?: string };

      if (d?.code === 0 && d.data) {
        const downloadUrl = d.data.download_url as string;
        if (downloadUrl) {
          setResult({
            download_url: downloadUrl,
            filename: (d.data.filename as string) || (d.data.name as string) || undefined,
          });
        } else {
          throw new Error('未获取到下载链接');
        }
      } else {
        throw new Error(d?.msg || '生成合同失败，请重试');
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : '生成合同失败，请重试');
    } finally {
      setGenerating(false);
    }
  }, [selectedId, title, generating, fields, customFields, values]);

  // -------------------------------------------------------------------------
  // Grouped fields (memoised)
  // -------------------------------------------------------------------------

  const groupedFields = useMemo(() => groupFields(fields), [fields]);
  const groupedCustom = useMemo(() => groupFields(customFields), [customFields]);

  // -------------------------------------------------------------------------
  // Filtered templates (by search query)
  // -------------------------------------------------------------------------

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  // -------------------------------------------------------------------------
  // Guard: non-logged-in users
  // -------------------------------------------------------------------------

  if (!user) {
    return <LoginPrompt />;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/25">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">合同模板</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            选择模板，填写信息，一键生成合同文档
          </p>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 lg:gap-6">
        {/* ===================== Left panel: template list ===================== */}
        <Card className="p-0 gap-0 lg:self-start flex flex-col">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-4 space-y-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              模板列表
              <Badge variant="secondary" className="ml-1">
                {filteredTemplates.length}
              </Badge>
            </CardTitle>

            {/* Category filter */}
            <Select
              value={selectedCategory || 'all'}
              onValueChange={(v) => setSelectedCategory(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-full" size="sm">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索模板名称…"
                className="h-8 pl-8 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 min-h-0">
            {loadingList ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="w-5 h-5 text-indigo-500" />
              </div>
            ) : listError ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-sm text-red-600 dark:text-red-400">{listError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => fetchTemplates(selectedCategory)}
                >
                  重试
                </Button>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  暂无合同模板
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {searchQuery ? '未找到匹配的模板' : '请管理员在后台添加模板'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-22rem)] lg:h-[480px]">
                <div className="p-2 space-y-1">
                  {filteredTemplates.map((tpl) => {
                    const isSelected = selectedId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className={cn(
                          'w-full text-left rounded-lg border p-3 transition-all duration-150',
                          isSelected
                            ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 ring-1 ring-indigo-300 dark:ring-indigo-700'
                            : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <div
                              className={cn(
                                'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors',
                                isSelected
                                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                              )}
                            >
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  'text-sm font-medium truncate',
                                  isSelected
                                    ? 'text-indigo-700 dark:text-indigo-300'
                                    : 'text-slate-800 dark:text-slate-200'
                                )}
                              >
                                {tpl.name}
                              </p>
                              {tpl.description && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">
                                  {tpl.description}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  {tpl.category}
                                </Badge>
                                {typeof tpl.fields_count === 'number' && tpl.fields_count > 0 && (
                                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                                    {tpl.fields_count} 字段
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* ===================== Right panel: form ===================== */}
        <Card className="p-0 gap-0">
          {!selectedTemplate ? (
            <EmptyState />
          ) : (
            <>
              {/* Template header */}
              <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  {selectedTemplate.name}
                </CardTitle>
                {selectedTemplate.description && (
                  <CardDescription className="text-xs leading-relaxed">
                    {selectedTemplate.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="p-4 lg:p-6 space-y-6">
                {/* Contract title (always required) */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="contract_title"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    合同标题 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contract_title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="请输入合同标题，如：房屋租赁合同"
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus-visible:border-indigo-400 focus-visible:ring-indigo-100 dark:focus-visible:ring-indigo-950"
                  />
                </div>

                {/* Loading fields */}
                {loadingFields ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                    <p className="text-sm text-slate-400">正在加载模板字段…</p>
                  </div>
                ) : (
                  <>
                    {/* Grouped API fields */}
                    {Array.from(groupedFields.entries()).map(([groupName, groupFields]) => (
                      <div
                        key={groupName}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4"
                      >
                        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-3 rounded-full bg-indigo-400" />
                          {groupName}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {groupFields.map((field) => (
                            <FieldInput
                              key={field.key}
                              field={field}
                              value={values[field.key] || ''}
                              onChange={(v) => setFieldValue(field.key, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Custom fields */}
                    {customFields.length > 0 &&
                      Array.from(groupedCustom.entries()).map(([groupName, groupFields]) => (
                        <div
                          key={groupName}
                          className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10 p-4 space-y-4"
                        >
                          <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                            <Plus className="w-3 h-3" />
                            {groupName}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {groupFields.map((field) => (
                              <FieldInput
                                key={field.key}
                                field={field}
                                value={values[field.key] || ''}
                                onChange={(v) => setFieldValue(field.key, v)}
                                onRemove={() => handleRemoveCustomField(field.key)}
                                custom
                              />
                            ))}
                          </div>
                        </div>
                      ))}

                    {/* Add custom field section */}
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 space-y-3">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                        <Plus className="w-4 h-4 text-indigo-500" />
                        手动添加字段
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_140px_auto] gap-2">
                        <Input
                          value={newFieldKey}
                          onChange={(e) => setNewFieldKey(e.target.value)}
                          placeholder="字段标识 (如: supplier)"
                          className="h-9 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700"
                        />
                        <Input
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          placeholder="显示名称 (如: 供应商)"
                          className="h-9 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700"
                        />
                        <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as FieldType)}>
                          <SelectTrigger className="w-full" size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">文本</SelectItem>
                            <SelectItem value="number">数字</SelectItem>
                            <SelectItem value="date">日期</SelectItem>
                            <SelectItem value="textarea">长文本</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleAddCustomField}
                          disabled={!newFieldKey.trim() || !newFieldLabel.trim()}
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          添加
                        </Button>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        添加自定义字段后，其值将一并填入生成请求中
                      </p>
                    </div>

                    {/* Generate error */}
                    {generateError && (
                      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-900">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="flex-1">{generateError}</span>
                      </div>
                    )}

                    {/* Generate button */}
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {fields.length + customFields.length} 个字段待填写
                      </p>
                      <Button
                        onClick={handleGenerate}
                        disabled={!title.trim() || generating}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            正在生成…
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4" />
                            生成合同
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Result area */}
                    {result && (
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            <CheckCircle className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                              合同已生成
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {result.filename || '合同文档已准备就绪，点击下方按钮下载'}
                            </p>
                            <Button
                              asChild
                              size="sm"
                              className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <a href={result.download_url} download>
                                <Download className="w-3.5 h-3.5" />
                                下载合同文档
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
