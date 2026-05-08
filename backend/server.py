from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

OBJECT_TYPES = ["note", "person", "task", "idea", "book", "project", "meeting", "daily"]


# ==================== Models ====================

class ObjectModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "note"
    title: str = ""
    body: str = ""
    tags: List[str] = Field(default_factory=list)
    ai_tags: List[str] = Field(default_factory=list)
    ai_summary: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ObjectCreate(BaseModel):
    type: str = "note"
    title: str = ""
    body: str = ""
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ObjectUpdate(BaseModel):
    type: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class RelatedItem(BaseModel):
    id: str
    type: str
    title: str
    score: int
    reason: str


# ==================== AI helpers ====================

def _strip_json(text: str) -> str:
    """Strip markdown code fences from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


async def ai_generate_tags(obj_type: str, title: str, body: str) -> Dict[str, Any]:
    """Returns {tags: [...], summary: str}"""
    if not EMERGENT_LLM_KEY or (not title.strip() and not body.strip()):
        return {"tags": [], "summary": ""}

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"tags-{uuid.uuid4()}",
        system_message=(
            "You are an assistant that extracts concise topic tags and one-line summaries "
            "from personal knowledge notes. Always reply with strict JSON only."
        ),
    ).with_model("gemini", "gemini-3-flash-preview")

    prompt = (
        f"Object type: {obj_type}\n"
        f"Title: {title}\n"
        f"Body: {body[:2000]}\n\n"
        "Return JSON with this exact shape:\n"
        '{"tags": ["tag1", "tag2", "tag3"], "summary": "one short sentence"}\n'
        "Rules: 3-6 lowercase single or two-word tags, no punctuation in tags, no #, no duplicates."
    )

    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        data = json.loads(_strip_json(resp))
        tags = [str(t).lower().strip().lstrip('#') for t in data.get("tags", [])][:6]
        summary = str(data.get("summary", "")).strip()
        return {"tags": [t for t in tags if t], "summary": summary}
    except Exception as e:
        logger.warning(f"ai_generate_tags failed: {e}")
        return {"tags": [], "summary": ""}


async def ai_find_related(current: dict, candidates: List[dict]) -> List[RelatedItem]:
    if not EMERGENT_LLM_KEY or not candidates:
        return []

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"related-{uuid.uuid4()}",
        system_message=(
            "You are an assistant that finds semantically related items in a personal "
            "knowledge graph. Reply with strict JSON only."
        ),
    ).with_model("gemini", "gemini-3-flash-preview")

    cand_text = "\n".join(
        f"- id={c['id']} | type={c['type']} | title={c.get('title','')} | "
        f"tags={','.join((c.get('tags') or []) + (c.get('ai_tags') or []))[:120]} | "
        f"snippet={(c.get('body') or '')[:160]}"
        for c in candidates[:80]
    )

    prompt = (
        "Current object:\n"
        f"id={current['id']} | type={current['type']} | title={current.get('title','')}\n"
        f"tags={','.join((current.get('tags') or []) + (current.get('ai_tags') or []))}\n"
        f"body={(current.get('body') or '')[:800]}\n\n"
        "Candidates:\n"
        f"{cand_text}\n\n"
        "Pick up to 5 most related candidates. Return JSON array, each item:\n"
        '{"id": "...", "score": 0-100, "reason": "short reason"}\n'
        "Only include items genuinely related. If none, return []."
    )

    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        data = json.loads(_strip_json(resp))
        if not isinstance(data, list):
            return []

        cand_map = {c["id"]: c for c in candidates}
        out = []
        for item in data[:5]:
            cid = item.get("id")
            if cid in cand_map:
                c = cand_map[cid]
                out.append(RelatedItem(
                    id=cid,
                    type=c["type"],
                    title=c.get("title", "") or "Untitled",
                    score=int(item.get("score", 0)),
                    reason=str(item.get("reason", ""))[:200],
                ))
        return out
    except Exception as e:
        logger.warning(f"ai_find_related failed: {e}")
        return []


# ==================== Routes ====================

@api_router.get("/")
async def root():
    return {"message": "Mindstack API"}


@api_router.get("/types")
async def get_types():
    return {"types": OBJECT_TYPES}


@api_router.get("/stats")
async def get_stats():
    counts: Dict[str, int] = {t: 0 for t in OBJECT_TYPES}
    pipeline = [{"$group": {"_id": "$type", "count": {"$sum": 1}}}]
    async for row in db.objects.aggregate(pipeline):
        if row["_id"] in counts:
            counts[row["_id"]] = row["count"]
    total = sum(counts.values())
    return {"counts": counts, "total": total}


@api_router.get("/objects", response_model=List[ObjectModel])
async def list_objects(type: Optional[str] = None, search: Optional[str] = None, limit: int = 200):
    query: Dict[str, Any] = {}
    if type and type != "all":
        query["type"] = type
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [
            {"title": rx},
            {"body": rx},
            {"tags": rx},
            {"ai_tags": rx},
        ]
    cursor = db.objects.find(query, {"_id": 0}).sort("updated_at", -1).limit(limit)
    return await cursor.to_list(limit)


@api_router.post("/objects", response_model=ObjectModel)
async def create_object(payload: ObjectCreate):
    if payload.type not in OBJECT_TYPES:
        raise HTTPException(400, f"Invalid type. Must be one of {OBJECT_TYPES}")
    obj = ObjectModel(**payload.model_dump())
    doc = obj.model_dump()
    await db.objects.insert_one(doc.copy())
    return obj


@api_router.get("/objects/{obj_id}", response_model=ObjectModel)
async def get_object(obj_id: str):
    doc = await db.objects.find_one({"id": obj_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Object not found")
    return ObjectModel(**doc)


@api_router.put("/objects/{obj_id}", response_model=ObjectModel)
async def update_object(obj_id: str, payload: ObjectUpdate):
    update: Dict[str, Any] = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "type" in update and update["type"] not in OBJECT_TYPES:
        raise HTTPException(400, "Invalid type")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.objects.find_one_and_update(
        {"id": obj_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(404, "Object not found")
    return ObjectModel(**result)


@api_router.delete("/objects/{obj_id}")
async def delete_object(obj_id: str):
    res = await db.objects.delete_one({"id": obj_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Object not found")
    return {"ok": True}


@api_router.post("/objects/{obj_id}/ai-enhance", response_model=ObjectModel)
async def ai_enhance(obj_id: str):
    doc = await db.objects.find_one({"id": obj_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Object not found")

    result = await ai_generate_tags(doc["type"], doc.get("title", ""), doc.get("body", ""))
    update = {
        "ai_tags": result["tags"],
        "ai_summary": result["summary"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    updated = await db.objects.find_one_and_update(
        {"id": obj_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    return ObjectModel(**updated)


@api_router.get("/objects/{obj_id}/related", response_model=List[RelatedItem])
async def get_related(obj_id: str):
    current = await db.objects.find_one({"id": obj_id}, {"_id": 0})
    if not current:
        raise HTTPException(404, "Object not found")

    others_cursor = db.objects.find(
        {"id": {"$ne": obj_id}},
        {"_id": 0, "id": 1, "type": 1, "title": 1, "body": 1, "tags": 1, "ai_tags": 1},
    ).limit(80)
    candidates = await others_cursor.to_list(80)
    return await ai_find_related(current, candidates)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
