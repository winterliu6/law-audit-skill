"""
公共法条爬虫：仅缺法条时启用，不上传用户合同隐私
从公开法律数据库抓取法条并入库
"""
import asyncio
import httpx
from bs4 import BeautifulSoup
from ..law_kb.knowledge_base import incremental_update


# 爬取频率限制
_last_crawl_time = 0
CRAWL_INTERVAL = 2  # 秒


async def crawl_npc_law(keyword: str) -> list:
    """
    从国家法律法规数据库爬取公开法条
    仅在知识库检索无结果时触发
    """
    global _last_crawl_time
    import time
    now = time.time()
    if now - _last_crawl_time < CRAWL_INTERVAL:
        await asyncio.sleep(CRAWL_INTERVAL - (now - _last_crawl_time))
    _last_crawl_time = time.time()

    results = []
    try:
        # 搜索公开法律数据库
        url = "https://flk.npc.gov.cn/api/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json"
        }
        params = {
            "type": "flfg",  # 法律法规
            "search": keyword,
            "page": 1,
            "size": 10
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("result", [])[:5]:
                    title = item.get("title", "")
                    content = item.get("content", "")
                    if content:
                        # 自动入库并增量刷新索引
                        incremental_update(
                        f"{title}\n{content}",
                            {"source": "NPC公开法条", "keyword": keyword, "title": title}
                        )
                        results.append({"title": title, "content": content[:200]})
    except Exception as e:
        print(f"[爬虫] 爬取失败: {e}")

    return results


async def search_and_update(keyword: str) -> list:
    """
    搜索法条：先查本地知识库，缺法条时触发爬虫
    """
    from ..law_kb.knowledge_base import search as kb_search

    # 先查本地
    local_results = kb_search(keyword, n_results=3)
    if local_results and local_results[0].get("score", 1) < 0.5:
        return local_results

    # 本地无结果，触发爬虫
    print(f"[爬虫] 本地知识库无匹配，启动爬虫抓取: {keyword}")
    crawled = await crawl_npc_law(keyword)

    # 爬取后重新检索
    if crawled:
        return kb_search(keyword, n_results=5)
    return local_results
