"""
本地法律知识库：ChromaDB向量数据库
支持增量更新索引、PDF/DOCX解析、基础法条初始化
"""
import os
import fitz  # PyMuPDF
from docx import Document as DocxDocument
from pathlib import Path
from ..config import CHROMA_DIR, KB_DIR

# ChromaDB延迟导入（首次使用时初始化）
_chroma_client = None
_collection = None


def _get_collection():
    """延迟初始化ChromaDB客户端和集合"""
    global _chroma_client, _collection
    if _collection is None:
        import chromadb
        _chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        _collection = _chroma_client.get_or_create_collection(
            name="law_articles",
            metadata={"hnsw:space": "cosine"}
        )
    return _collection


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list:
    """文本切片：按字符数分块，保留重叠区域保证语义连贯"""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks


def add_document(text: str, metadata: dict = None):
    """添加文档到知识库，自动切片后入库"""
    col = _get_collection()
    chunks = chunk_text(text)
    if not chunks:
        return

    base_id = f"doc_{col.count()}"
    for i, chunk in enumerate(chunks):
        doc_id = f"{base_id}_{i}"
        meta = metadata or {}
        meta["chunk_index"] = i
        col.add(
            ids=[doc_id],
            documents=[chunk],
            metadatas=[meta]
        )


def incremental_update(text: str, metadata: dict = None):
    """增量更新：添加单条文档，即时生效可检索"""
    add_document(text, metadata)


def search(query: str, n_results: int = 5) -> list:
    """向量检索：返回最相关的法条片段"""
    col = _get_collection()
    if col.count() == 0:
        return []
    results = col.query(query_texts=[query], n_results=min(n_results, col.count()))
    items = []
    for i in range(len(results["ids"][0])):
        items.append({
            "id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
            "score": results["distances"][0][i] if results["distances"] else 0
        })
    return items


def rebuild_index():
    """全量重建索引：清空后重新入库所有知识库文件"""
    global _collection
    import chromadb
    _chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    try:
        _chroma_client.delete_collection("law_articles")
    except Exception:
        pass
    _collection = _chroma_client.get_or_create_collection(
        name="law_articles",
        metadata={"hnsw:space": "cosine"}
    )
    # 重新扫描knowledge_base目录下的所有文档
    _scan_and_index_kb_files()
    init_base_knowledge()


def parse_pdf(path: str) -> str:
    """解析PDF文件，提取全文文本"""
    doc = fitz.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


def parse_docx(path: str) -> str:
    """解析DOCX文件，提取全文文本"""
    doc = DocxDocument(path)
    return chr(10).join([p.text for p in doc.paragraphs if p.text.strip()])


def _scan_and_index_kb_files():
    """扫描知识库文件目录，解析并入库"""
    from ..config import KB_UPLOAD_DIR
    for f in KB_UPLOAD_DIR.iterdir():
        if f.suffix.lower() == '.pdf':
            text = parse_pdf(str(f))
            add_document(text, {"source": f.name, "type": "pdf"})
        elif f.suffix.lower() == '.docx':
            text = parse_docx(str(f))
            add_document(text, {"source": f.name, "type": "docx"})
        elif f.suffix.lower() == '.txt':
            text = f.read_text(encoding='utf-8')
            add_document(text, {"source": f.name, "type": "txt"})


def init_base_knowledge():
    """初始化基础法律知识库：民法典、合同法、公司法核心条文"""
    col = _get_collection()
    if col.count() > 0:
        print("[知识库] 已有数据，跳过基础初始化")
        return

    # 民法典核心条文（节选）
    civil_law = [
        "第一百四十三条 具备下列条件的民事法律行为有效：（一）行为人具有相应的民事行为能力；（二）意思表示真实；（三）不违反法律、行政法规的强制性规定，不违背公序良俗。",
        "第四百六十九条 当事人订立合同，可以采用书面形式、口头形式或者其他形式。书面形式是合同书、信件、电报、电传、传真等可以有形地表现所载内容的形式。以电子数据交换、电子邮件等方式能够有形地表现所载内容，并可以随时调取查用的数据电文，视为书面形式。",
        "第五百零二条 依法成立的合同，自成立时生效，但是法律另有规定或者当事人另有约定的除外。依照法律、行政法规的规定，合同应当办理批准等手续的，依照其规定。",
        "第五百零九条 当事人应当按照约定全面履行自己的义务。当事人应当遵循诚信原则，根据合同的性质、目的和交易习惯履行通知、协助、保密等义务。",
        "第五百七十七条 当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。",
        "第五百八十五条 当事人可以约定一方违约时应当根据违约情况向对方支付一定数额的违约金，也可以约定因违约产生的损失赔偿额的计算方法。",
    ]

    # 合同法核心知识
    contract_law = [
        "合同审核要点：1.合同主体资格审查（营业执照、法定代表人身份）；2.合同标的是否明确具体；3.数量、质量、价款是否约定清楚；4.履行期限、地点、方式是否明确；5.违约责任条款是否合理；6.争议解决条款（仲裁/诉讼）。",
        "合同风险类型：1.主体风险（无资质、被吊销执照）；2.条款风险（显失公平、格式条款）；3.履约风险（无担保、无违约金）；4.时效风险（超过诉讼时效）；5.管辖风险（约定不明确）。",
        "格式条款提示义务：提供格式条款的一方应当遵循公平原则确定当事人之间的权利和义务，并采取合理的方式提请对方注意免除或者减轻其责任等与对方有重大利害关系的条款，按照对方的要求，对该条款予以说明。",
    ]

    # 公司法核心
    company_law = [
        "公司法定代表人依照公司章程的规定，由董事长、执行董事或者经理担任，并依法登记。公司法定代表人变更，应当办理变更登记。",
        "公司对外投资或者为他人提供担保，依照公司章程的规定，由董事会或者股东会、股东大会决议。",
        "股东应当按期足额缴纳公司章程中规定的各自所认缴的出资额。股东以货币出资的，应当将货币出资足额存入公司在银行开设的账户。",
    ]

    for text in civil_law:
        add_document(text, {"source": "民法典", "type": "法条"})
    for text in contract_law:
        add_document(text, {"source": "合同法知识", "type": "知识"})
    for text in company_law:
        add_document(text, {"source": "公司法", "type": "法条"})

    print(f"[知识库] 基础法条初始化完成，共 {col.count()} 条")
