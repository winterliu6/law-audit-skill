"""
Contract Template Field Detection Engine (Pure Text Mode)
Identifies fillable fields from contract text without requiring any placeholder markers.
Uses semantic keywords, sentence patterns, empty cells, and standard contract formats.
"""
import re
from typing import List, Dict, Optional
from collections import OrderedDict

# ============================================================
# Regex pattern library for detecting fillable fields
# ============================================================

# Whitespace class that includes full-width space (　) + regular spaces
_W = r'[\s　]*'

# Party information patterns
_PARTY_PATTERNS = [
    (r'(?:甲方|乙方|丙方|发包方|承包方|委托方|受托方|买方|卖方|承租方|出租方'
     r'|供方|需方|服务方|客户方|借款方|贷款方|担保方|出让方|受让方)' + _W + r'[：:]' + _W + r'$', 'party_name'),
    (r'(?:名称|公司名称|单位名称|企业名称|姓' + _W + r'名|名' + _W + r'称)' + _W + r'[：:]' + _W + r'$', 'party_name'),
    (r'(?:地址|住所|注册地址|经营地址|通讯地址|地' + _W + r'址)' + _W + r'[：:]' + _W + r'$', 'address'),
    (r'(?:法定代表人|法人代表|负责人|授权代表)' + _W + r'[：:]' + _W + r'$', 'legal_rep'),
    (r'(?:统一社会信用代码|社会信用代码|营业执照号|信用代码|税号)' + _W + r'[：:]' + _W + r'$', 'credit_code'),
    (r'(?:联系电话|电话|手机|联系方式)' + _W + r'[：:]' + _W + r'$', 'phone'),
    (r'(?:开户行|开户银行|银行名称)' + _W + r'[：:]' + _W + r'$', 'bank_name'),
    (r'(?:开户名|账户名称|户' + _W + r'名)' + _W + r'[：:]' + _W + r'$', 'account_name'),
    (r'(?:账号|银行账号|银行账户|收款账号|账' + _W + r'号)' + _W + r'[：:]' + _W + r'$', 'bank_account'),
    (r'(?:邮政编码|邮编)' + _W + r'[：:]' + _W + r'$', 'zip_code'),
    (r'(?:传真|传真号码)' + _W + r'[：:]' + _W + r'$', 'fax'),
    (r'(?:电子邮箱|邮箱|E-?mail)' + _W + r'[：:]' + _W + r'$', 'email'),
]

# Date patterns
_DATE_PATTERNS = [
    (r'(?:签订日期|签署日期|签约日期)' + _W + r'[：:]' + _W + r'$', 'sign_date'),
    (r'(?:生效日期|起始日期|开始日期)' + _W + r'[：:]' + _W + r'$', 'effective_date'),
    (r'(?:截止日期|终止日期|届满日期|到期日)' + _W + r'[：:]' + _W + r'$', 'expire_date'),
    (r'(?:履行期限|合同期限|服务期限|有效期|期限)' + _W + r'[：:]' + _W + r'$', 'duration'),
    (r'(?:付款日期|支付日期|付款时间)' + _W + r'[：:]' + _W + r'$', 'payment_date'),
    # Inline dates with year number: "2025年 月 日"
    (r'\d{2,4}\s*年\s+月\s+日', 'date_inline'),
    (r'\d{2,4}\s*年\s*\d{1,2}\s*月\s+日', 'date_inline'),
    # Blank dates: "    年  月  日" (no year number, spaces before 年)
    (r'(?:从|自|至|起)\s{2,}年\s+月\s+日', 'date_blank_range'),
    (r'^\s{2,}年\s+月\s+日', 'date_blank'),
    (r'^\s*年\s*月\s*日\s*$', 'date_blank'),
    # Date with colon: "日期：     年    月     日"
    (r'(?:日期|签订日期|签署日期)' + _W + r'[：:]' + _W + r'\d*\s*年', 'sign_date'),
]

# Amount patterns (with full-width space support)
_AMOUNT_PATTERNS = [
    (r'(?:合同金额|合同总价|合同价款|合同总金额|总价|总额|总金额|合同价)' + _W + r'[：:]' + _W + r'$', 'total_amount'),
    (r'(?:人民币|金额|价款|价格|大写)' + _W + r'[：:]' + _W + r'$', 'amount'),
    (r'(?:小写|￥|¥)' + _W + r'[：:]' + _W + r'$', 'amount_num'),
    (r'(?:单价)' + _W + r'[：:]' + _W + r'$', 'unit_price'),
    (r'(?:预付款|预付金|定金|首款|预付|首付)' + _W + r'[：:]' + _W + r'$', 'prepay'),
    (r'(?:尾款|余款|剩余款项)' + _W + r'[：:]' + _W + r'$', 'balance'),
    (r'(?:服务费|手续费|管理费|佣金|报酬)' + _W + r'[：:]' + _W + r'$', 'service_fee'),
    (r'(?:违约金|滞纳金|罚金|赔偿金)' + _W + r'[：:]' + _W + r'$', 'penalty'),
    (r'(?:保证金|押金|担保金)' + _W + r'[：:]' + _W + r'$', 'deposit'),
    (r'(?:税率|税额)' + _W + r'[：:]' + _W + r'$', 'tax'),
    # Inline amount with blank: "人民币    元整  （￥    元/月）"
    (r'人民币\s{2,}元', 'amount_inline'),
    (r'[￥¥]\s{2,}元', 'amount_inline_num'),
]

# Custom content patterns (with full-width space support)
_CUSTOM_PATTERNS = [
    (r'(?:服务内容|服务范围|工作内容|服务项目|服务描述)' + _W + r'[：:]' + _W + r'$', 'service_content'),
    (r'(?:合作范围|合作内容|项目内容)' + _W + r'[：:]' + _W + r'$', 'coop_scope'),
    (r'(?:履行地点|履约地点|服务地点|交货地点)' + _W + r'[：:]' + _W + r'$', 'perform_location'),
    (r'(?:履行方式|履约方式|服务方式|交付方式)' + _W + r'[：:]' + _W + r'$', 'perform_method'),
    (r'(?:补充约定|补充条款|特别约定|其他约定|附加条款)' + _W + r'[：:]' + _W + r'$', 'supplement'),
    (r'(?:附件说明|附件)' + _W + r'[：:]' + _W + r'$', 'attachment_desc'),
    (r'(?:备注|特别说明|其他说明)' + _W + r'[：:]' + _W + r'$', 'remark'),
    (r'(?:验收标准|质量标准|技术标准)' + _W + r'[：:]' + _W + r'$', 'acceptance'),
    (r'(?:保质期|保修期|质保期)' + _W + r'[：:]' + _W + r'$', 'warranty'),
    (r'(?:争议解决|管辖法院|仲裁机构)' + _W + r'[：:]' + _W + r'$', 'dispute'),
    (r'(?:合同编号|合同号|甲方合同编号|乙方合同编号|编号)' + _W + r'[：:]' + _W + r'$', 'contract_no'),
    (r'(?:签订地点|签署地点)' + _W + r'[：:]' + _W + r'$', 'sign_location'),
    (r'(?:具体内容|详细内容|主要条款|业务范围)\s*[（(][^）)]*[）)]' + _W + r'[：:]' + _W + r'$', 'detail_content'),
]


# ============================================================
# Exclusion patterns (standard boilerplate, NOT fillable fields)
# ============================================================

_EXCLUDE_PATTERNS = [
    r'一式[两二三四]份',
    r'(?:签字|签章|盖章)\s*(?:后|之日起).*生效',
    r'(?:签字|盖章|签章)\s*(?:生效|有效)',
    r'本合同.*?(?:一式|份)',
    r'(?:附件|附录)\s*\d',
    r'（以下统称.*?）',
    r'（以下简称.*?）',
    r'以下统称',
    r'以下简称',
    r'鉴于[：:]',
    r'本合同.*?签订之日起',
    r'双方.*?协商一致',
    r'经双方.*?协商',
    r'本合同未尽事宜',
    r'本合同一式',
    r'与本合同具有同等',
    r'补充协议.*?同等效力',
]


# ============================================================
# Field priority (for form ordering)
# ============================================================

_PRIORITY = {
    'party_name': 1, 'legal_rep': 1, 'credit_code': 1,
    'address': 2, 'phone': 2, 'email': 2, 'fax': 2, 'zip_code': 2,
    'bank_name': 2, 'bank_account': 2, 'account_name': 2,
    'sign_date': 3, 'effective_date': 3, 'expire_date': 3,
    'payment_date': 3, 'duration': 3, 'date_inline': 3, 'date_blank': 3,
    'total_amount': 4, 'amount': 4, 'amount_num': 4, 'unit_price': 4,
    'prepay': 4, 'balance': 4, 'service_fee': 4, 'penalty': 4,
    'deposit': 4, 'tax': 4,
    'contract_no': 5, 'sign_location': 5,
    'service_content': 6, 'coop_scope': 6, 'perform_location': 6,
    'perform_method': 6, 'acceptance': 6, 'warranty': 6,
    'supplement': 7, 'remark': 7, 'dispute': 7,
    'attachment_desc': 7, 'detail_content': 7, 'other': 9,
}


# ============================================================
# Core detection logic
# ============================================================

def detect_fields(doc) -> List[Dict]:
    """
    Analyze a python-docx Document object and detect all fillable fields.
    Returns a structured list: [{key, label, type, group, priority, context}]
    """
    found = OrderedDict()

    # --- 1. Scan paragraph text ---
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text or len(text) > 300:
            continue
        if _is_excluded(text):
            continue
        field = _match_field(text)
        if field and field['key'] not in found:
            # Store context for fill-back matching
            field['context'] = text
            found[field['key']] = field

    # --- 2. Scan table cells ---
    for table in doc.tables:
        for row_idx, row in enumerate(table.rows):
            for cell in row.cells:
                cell_text = cell.text.strip()
                if not cell_text:
                    continue
                if _is_excluded(cell_text):
                    continue
                field = _match_field(cell_text)
                if field and field['key'] not in found:
                    context = _get_table_header(table, row_idx)
                    field['context'] = context + ' > ' + cell_text[:50]
                    found[field['key']] = field

                # Detect empty table cells (blank = fillable)
                if _is_empty_cell(cell_text):
                    context = _get_table_header(table, row_idx)
                    if context and len(context) < 30:
                        key = _normalize_key(context)
                        if key not in found:
                            found[key] = {
                                'key': key, 'label': context,
                                'type': 'text', 'group': '表格填写项',
                                'priority': 8,
                                'context': '表格 > ' + context,
                            }

    result = sorted(found.values(), key=lambda f: f.get('priority', 99))
    return result


def _match_field(text: str) -> Optional[Dict]:
    """Match a single line of text against all patterns."""
    for pattern, ftype in _PARTY_PATTERNS:
        if re.search(pattern, text):
            label = re.sub(r'[：:\s]', '', re.split(r'[：:]', text)[0])
            return _make_field(ftype, label, 'party')

    for pattern, ftype in _DATE_PATTERNS:
        if re.search(pattern, text):
            if ftype in ('date_inline', 'date_blank', 'date_blank_range'):
                label = '日期'
            elif '：' in text or ':' in text:
                label = re.sub(r'[：:\s]', '', re.split(r'[：:]', text)[0])
            else:
                label = '日期'
            return _make_field(ftype, label, 'date')

    for pattern, ftype in _AMOUNT_PATTERNS:
        if re.search(pattern, text):
            if ftype in ('amount_inline', 'amount_inline_num'):
                label = '合同金额'
            elif '：' in text or ':' in text:
                label = re.sub(r'[：:\s]', '', re.split(r'[：:]', text)[0])
            else:
                label = '合同金额'
            return _make_field(ftype, label, 'amount')

    for pattern, ftype in _CUSTOM_PATTERNS:
        if re.search(pattern, text):
            label = re.sub(r'[：:\s]', '', re.split(r'[：:]', text)[0])
            return _make_field(ftype, label, 'custom')

    return None


# ============================================================
# Field construction helpers
# ============================================================

_DEFAULT_LABELS = {
    'party_name': '甲方/乙方名称', 'address': '地址',
    'legal_rep': '法定代表人', 'credit_code': '统一社会信用代码',
    'phone': '联系电话', 'email': '电子邮箱', 'fax': '传真',
    'zip_code': '邮政编码', 'bank_name': '开户行',
    'bank_account': '银行账号', 'account_name': '账户名称',
    'sign_date': '签订日期', 'effective_date': '生效日期',
    'expire_date': '截止日期', 'duration': '合同期限',
    'payment_date': '付款日期', 'date_inline': '日期',
    'date_blank': '日期', 'date_blank_range': '日期',
    'total_amount': '合同总金额', 'amount': '金额',
    'amount_num': '金额(小写)', 'unit_price': '单价',
    'amount_inline': '金额(大写)', 'amount_inline_num': '金额(小写)',
    'prepay': '预付款', 'balance': '尾款',
    'service_fee': '服务费', 'penalty': '违约金',
    'deposit': '保证金', 'tax': '税率',
    'contract_no': '合同编号', 'sign_location': '签订地点',
    'service_content': '服务内容', 'coop_scope': '合作范围',
    'perform_location': '履行地点', 'perform_method': '履行方式',
    'supplement': '补充约定', 'remark': '备注',
    'attachment_desc': '附件说明', 'acceptance': '验收标准',
    'warranty': '保质期', 'dispute': '争议解决',
    'detail_content': '详细内容',
}

_GROUP_MAP = {
    'party': '甲乙双方信息', 'date': '日期信息',
    'amount': '金额信息', 'custom': '合同内容',
}


def _make_field(ftype: str, label: str, group: str) -> Dict:
    """Build a standardized field info dict."""
    # Infer input type
    if ftype in ('date_inline', 'date_blank', 'date_blank_range',
                 'sign_date', 'effective_date', 'expire_date', 'payment_date'):
        input_type = 'date'
    elif ftype in ('total_amount', 'amount', 'amount_num', 'unit_price',
                   'prepay', 'balance', 'service_fee', 'penalty',
                   'deposit', 'tax', 'amount_inline', 'amount_inline_num'):
        input_type = 'number'
    elif ftype in ('service_content', 'coop_scope', 'supplement',
                   'remark', 'detail_content', 'perform_method',
                   'acceptance', 'dispute'):
        input_type = 'textarea'
    else:
        input_type = 'text'

    if not label or len(label) < 2:
        label = _DEFAULT_LABELS.get(ftype, '待填写项')

    return {
        'key': ftype + '_' + _normalize_key(label),
        'label': label,
        'type': input_type,
        'group': _GROUP_MAP.get(group, '合同内容'),
        'priority': _PRIORITY.get(ftype, 9),
    }


# ============================================================
# Utility functions
# ============================================================

def _is_excluded(text: str) -> bool:
    """Check if text is standard boilerplate (not a fillable field)."""
    for pat in _EXCLUDE_PATTERNS:
        if re.search(pat, text):
            return True
    return False


def _is_empty_cell(text: str) -> bool:
    """Check if a table cell is empty/fillable."""
    clean = text.replace('\n', '').replace('\r', '').strip()
    if not clean:
        return True
    if re.match(r'^[\s\u3000_—–-]+$', clean):
        return True
    if clean in ('/', '-', '—', '──', '——', '…', 'N/A', 'n/a'):
        return True
    return False


def _get_table_header(table, current_row_idx: int) -> str:
    """Look upward in the table to find a header row as context label."""
    for i in range(current_row_idx - 1, -1, -1):
        row = table.rows[i]
        texts = [c.text.strip() for c in row.cells if c.text.strip()]
        if texts and len(''.join(texts)) < 60:
            return ' '.join(texts)
    return ''


def _normalize_key(label: str) -> str:
    """Convert a Chinese label to a safe form key."""
    s = re.sub(r'[（(]', '_', label)
    s = re.sub(r'[）)\[\]【】\s]', '', s)
    s = re.sub(r'[^a-zA-Z0-9\u4e00-\u9fff_-]', '', s)
    return s[:40] if s else 'field'


# ============================================================
# Fill-back: replace detected fields in a Document
# ============================================================

def _replace_para_preserve_style(para, old_text: str, new_text: str):
    """
    Replace paragraph text while preserving Run styles (font, size, color, bold).
    Strategy: set full text on the first Run, clear the rest.
    """
    if not para.runs:
        return
    para.runs[0].text = new_text
    for run in para.runs[1:]:
        run.text = ''


def _replace_in_table(table, fields: List[Dict], filled: Dict, replaced: set) -> int:
    """
    Replace field values in table cells.
    Tables have special text structure; match by XML text elements.
    """
    count = 0
    for row in table.rows:
        for cell in row.cells:
            # Method 1: paragraph text
            for para in cell.paragraphs:
                full = para.text
                if not full.strip():
                    continue
                for field in fields:
                    ctx = field.get('context', '')
                    if not ctx or field['key'] in replaced:
                        continue
                    val = filled.get(field['key'], '')
                    if not val:
                        continue
                    if ctx in full:
                        parts = re.split(r'[：:]', full, maxsplit=1)
                        if len(parts) == 2:
                            new_text = parts[0] + '：' + val
                            _replace_para_preserve_style(para, full, new_text)
                            replaced.add(field['key'])
                            count += 1

            # Method 2: raw cell text (fallback for cells without paragraph structure)
            cell_text = cell.text.strip()
            if not cell_text:
                continue
            for field in fields:
                ctx = field.get('context', '')
                if not ctx or field['key'] in replaced:
                    continue
                val = filled.get(field['key'], '')
                if not val:
                    continue
                if ctx in cell_text:
                    for child in cell._tc:
                        for elem in child.iter():
                            if elem.text and ctx in elem.text:
                                parts = re.split(r'[：:]', elem.text, maxsplit=1)
                                if len(parts) == 2:
                                    elem.text = parts[0] + '：' + val
                                replaced.add(field['key'])
                                count += 1
                                break
    return count


def replace_detected_fields(doc, fields: List[Dict], filled: Dict) -> int:
    """
    Precisely fill user data into a python-docx Document.
    - Iterates paragraphs and tables
    - Matches by field.context to find original text positions
    - Replaces "keyword: blank" with "keyword: user_value"
    - Preserves all original fonts, sizes, colors, bold, etc.
    Returns the number of successfully replaced fields.
    """
    replaced = set()

    # --- Paragraph replacement ---
    for para in doc.paragraphs:
        full = para.text.strip()
        if not full:
            continue
        for field in fields:
            if field['key'] in replaced:
                continue
            val = filled.get(field['key'], '')
            if not val:
                continue
            ctx = field.get('context', '')
            label = field.get('label', '')
            ftype = field.get('type', '')
            fkey = field.get('key', '')

            # Strategy 1: inline date pattern (no colon, like "从  年 月 日")
            # Check BEFORE colon-based strategies
            # Guard: only match if the paragraph is relevant to this field
            # Cross-run date matching: ONLY for blank/range date types
            # Looks for "pure-spaces" runs followed by "年" runs
            _ftype_allows_crossrun = 'date_blank' in fkey
            if ftype == 'date' and len(para.runs) > 3 and _ftype_allows_crossrun:
                runs = para.runs
                for ri in range(len(runs) - 1):
                    curr = runs[ri].text
                    next_text = runs[ri+1].text if ri+1 < len(runs) else ''
                    # Must be: pure-spaces (>=3) + next run is exactly '年'
                    if not (curr.strip() == '' and len(curr) >= 3 and next_text.strip() == '年'):
                        continue
                    # Verify 年+月+日 structure follows in subsequent runs
                    lookahead = ''.join(r.text for r in runs[ri+1:min(ri+10, len(runs))])
                    if not ('年' in lookahead and '月' in lookahead and '日' in lookahead):
                        continue
                    # Guard: skip '为   年' pattern (year count, not date placeholder)
                    if ri > 0 and runs[ri-1].text.strip().endswith('为'):
                        # Check if '从' appears in nearby runs (date marker)
                        nearby = ''.join(r.text for r in runs[max(0,ri-2):min(ri+5, len(runs))])
                        if '从' not in nearby and '自' not in nearby:
                            continue
                    # Replace the blank spaces with the value
                    runs[ri].text = val
                    # Clear subsequent blank + unit runs (年/月/日起至 pattern)
                    for j in range(ri+1, min(ri+20, len(runs))):
                        rs = runs[j].text.strip()
                        if rs == '':
                            continue
                        elif rs in ('年', '月', '日'):
                            runs[j].text = ''
                        elif len(rs) <= 3 and all(c in '年月日起至止， ' for c in rs):
                            runs[j].text = ''
                        elif rs.startswith('日起') or rs.startswith('日至'):
                            runs[j].text = rs[2:] if len(rs) > 2 else ''
                        elif rs.startswith('日'):
                            runs[j].text = rs[1:]
                        else:
                            break
                    replaced.add(fkey)
                    break

            # Strategy 2: inline amount (like "人民币    元整" or "￥    元/月")
            if fkey not in replaced and ftype == 'number':
                runs = para.runs
                for ri in range(len(runs) - 1):
                    rt = runs[ri].text
                    nt = runs[ri+1].text if ri+1 < len(runs) else ''
                    # Pattern: run ends with "人民币", next run is blank + "元"
                    if rt.endswith('人民币') and nt.strip().startswith('元') and len(nt) - len(nt.lstrip()) >= 2:
                        # Replace blank portion in next run
                        stripped = nt.lstrip()
                        runs[ri+1].text = val + stripped
                        replaced.add(fkey)
                        break
                    # Pattern: run ends with "￥"/"¥", next run is blank + "元"
                    if (rt.endswith('￥') or rt.endswith('¥')) and '元' in nt and len(nt) - len(nt.lstrip()) >= 2:
                        stripped = nt.lstrip()
                        runs[ri+1].text = val + stripped
                        replaced.add(fkey)
                        break

            # Strategy 3: colon-based match (most common pattern: "关键词：空白")
            if fkey not in replaced and ctx and ctx in full:
                # Guard: verify the field's label is in this paragraph
                if label and (label in full or label.replace(' ', '') in full.replace(' ', '')):
                    parts = re.split(r'[：:]', full, maxsplit=1)
                    if len(parts) == 2:
                        new_text = parts[0] + '：' + val
                        _replace_para_preserve_style(para, full, new_text)
                        replaced.add(fkey)
                elif not label:
                    parts = re.split(r'[：:]', full, maxsplit=1)
                    if len(parts) == 2:
                        new_text = parts[0] + '：' + val
                        _replace_para_preserve_style(para, full, new_text)
                        replaced.add(fkey)

            # Strategy 4: label + colon match (fallback)
            if fkey not in replaced and label and label in full and ('：' in full or ':' in full):
                parts = re.split(r'[：:]', full, maxsplit=1)
                if len(parts) == 2 and not parts[1].strip():
                    new_text = parts[0] + '：' + val
                    _replace_para_preserve_style(para, full, new_text)
                    replaced.add(fkey)

    # --- Table replacement ---
    for table in doc.tables:
        _replace_in_table(table, fields, filled, replaced)

    return len(replaced)
