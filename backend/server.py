from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import random
import logging
import bcrypt
import jwt as pyjwt
from typing import Optional, List, Literal
from datetime import datetime, timezone, timedelta, date

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------------- Setup ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'devsecret')
JWT_ALG = 'HS256'

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('saudeconecta')

app = FastAPI(title="SaúdeConecta API")
api = APIRouter(prefix="/api")

# ---------------- Utils ----------------
def now_utc():
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.isoformat()

def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def make_token(user_id: str, email: str, role: str, minutes=60*24) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": now_utc() + timedelta(minutes=minutes), "type": "access"}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

# ---------------- Models ----------------
Role = Literal["medico", "atendente", "secretario", "admin"]

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Role
    crm: Optional[str] = None
    specialty: Optional[str] = None
    unit: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    crm: Optional[str] = None
    specialty: Optional[str] = None
    unit: Optional[str] = None

class PatientCreate(BaseModel):
    name: str
    cpf: str
    birth_date: str
    phone: Optional[str] = None
    address: Optional[str] = None
    lgpd_accepted: bool = False

class AppointmentCreate(BaseModel):
    patient_id: str
    doctor_id: str
    specialty: str
    scheduled_at: str  # ISO
    priority: Literal["normal", "preferencial", "urgente"] = "normal"
    unit: str = "UBS Central"

class PrescriptionCreate(BaseModel):
    patient_id: str
    medication: str
    active_substance: str
    dosage: str
    frequency: str
    duration_days: int
    route: str = "Oral"
    schedule: List[str] = []  # ["08:00","20:00"]
    justification: Optional[str] = None  # for override

class ExamRequest(BaseModel):
    patient_id: str
    exams: List[str]
    preparation_notes: Optional[str] = None
    urgent: bool = False

class ConsultUpdate(BaseModel):
    status: Literal["compareceu", "faltou", "aguardando"]
    justification: Optional[str] = None

class MedIntakeConfirm(BaseModel):
    prescription_id: str
    scheduled_time: str

# ---------------- Auth ----------------
async def audit(user: dict, action: str, target: str = "", details: dict = None):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "user_role": user.get("role"),
        "action": action,
        "target": target,
        "details": details or {},
        "timestamp": iso(now_utc()),
    })

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "Usuário não encontrado")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")

def require_roles(*roles):
    async def _check(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Acesso negado")
        return user
    return _check

# ---------------- Auth Routes ----------------
@api.post("/auth/register")
async def register(data: UserCreate, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email já cadastrado")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "name": data.name, "role": data.role,
        "password_hash": hash_pw(data.password),
        "crm": data.crm, "specialty": data.specialty, "unit": data.unit,
        "created_at": iso(now_utc()), "active": True,
    }
    await db.users.insert_one(doc)
    tok = make_token(uid, email, data.role)
    response.set_cookie("access_token", tok, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    doc.pop("password_hash"); doc.pop("_id", None)
    return doc

@api.post("/auth/login")
async def login(data: UserLogin, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_pw(data.password, user["password_hash"]):
        raise HTTPException(401, "Credenciais inválidas")
    tok = make_token(user["id"], email, user["role"])
    response.set_cookie("access_token", tok, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    user.pop("password_hash"); user.pop("_id", None)
    return {**user, "token": tok}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------------- Users / Admin ----------------
@api.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    # Atendente needs doctor list for scheduling. Admin/Secretario see everyone.
    if user["role"] not in ("admin", "secretario", "atendente"):
        raise HTTPException(403, "Acesso negado")
    query = {} if user["role"] in ("admin", "secretario") else {"role": "medico"}
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    return users

@api.post("/users")
async def create_user(data: UserCreate, user: dict = Depends(require_roles("admin"))):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email já cadastrado")
    uid = str(uuid.uuid4())
    doc = {"id": uid, "email": email, "name": data.name, "role": data.role,
           "password_hash": hash_pw(data.password), "crm": data.crm,
           "specialty": data.specialty, "unit": data.unit,
           "created_at": iso(now_utc()), "active": True}
    await db.users.insert_one(doc)
    await audit(user, "user.create", uid, {"role": data.role})
    doc.pop("password_hash"); doc.pop("_id", None)
    return doc

# ---------------- Patients ----------------
@api.get("/patients")
async def list_patients(q: str = "", user: dict = Depends(get_current_user)):
    query = {}
    if q:
        query = {"$or": [{"name": {"$regex": q, "$options": "i"}}, {"cpf": {"$regex": q}}]}
    patients = await db.patients.find(query, {"_id": 0}).to_list(300)
    return patients

@api.get("/patients/{pid}")
async def get_patient(pid: str, user: dict = Depends(get_current_user)):
    p = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Paciente não encontrado")
    # LGPD: history hidden if not accepted
    if not p.get("lgpd_accepted"):
        p["history_hidden"] = True
        p["prescriptions_history"] = []
    else:
        prescs = await db.prescriptions.find({"patient_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(100)
        p["prescriptions_history"] = prescs
    return p

@api.post("/patients")
async def create_patient(data: PatientCreate, user: dict = Depends(require_roles("atendente", "admin", "medico"))):
    if await db.patients.find_one({"cpf": data.cpf}):
        raise HTTPException(400, "CPF já cadastrado")
    pid = str(uuid.uuid4())
    doc = {"id": pid, **data.model_dump(), "active": True, "missed_count": 0,
           "blocked_online": False, "created_at": iso(now_utc())}
    await db.patients.insert_one(doc)
    doc.pop("_id", None)
    return doc

# ---------------- Appointments / Queue ----------------
@api.get("/appointments")
async def list_appointments(
    date_str: Optional[str] = Query(None, alias="date"),
    doctor_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if date_str:
        query["scheduled_at"] = {"$regex": f"^{date_str}"}
    if doctor_id:
        query["doctor_id"] = doctor_id
    elif user["role"] == "medico":
        query["doctor_id"] = user["id"]
    appts = await db.appointments.find(query, {"_id": 0}).sort("scheduled_at", 1).to_list(500)
    for a in appts:
        p = await db.patients.find_one({"id": a["patient_id"]}, {"_id": 0, "name": 1, "cpf": 1, "birth_date": 1})
        a["patient"] = p or {}
    return appts

@api.post("/appointments")
async def create_appointment(data: AppointmentCreate, user: dict = Depends(require_roles("atendente", "admin"))):
    aid = str(uuid.uuid4())
    doc = {"id": aid, **data.model_dump(), "status": "aguardando",
           "checked_in": False, "created_at": iso(now_utc()), "created_by": user["id"]}
    await db.appointments.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.patch("/appointments/{aid}")
async def update_appointment(aid: str, data: ConsultUpdate, user: dict = Depends(get_current_user)):
    upd = {"status": data.status, "updated_at": iso(now_utc())}
    if data.justification:
        upd["justification"] = data.justification
    appt = await db.appointments.find_one({"id": aid})
    if not appt:
        raise HTTPException(404, "Consulta não encontrada")
    await db.appointments.update_one({"id": aid}, {"$set": upd})
    if data.status == "faltou" and not data.justification:
        await db.patients.update_one({"id": appt["patient_id"]}, {"$inc": {"missed_count": 1}})
        pat = await db.patients.find_one({"id": appt["patient_id"]})
        if pat and pat.get("missed_count", 0) >= 2:
            await db.patients.update_one({"id": appt["patient_id"]}, {"$set": {"blocked_online": True}})
    await audit(user, "appointment.update", aid, {"status": data.status})
    return {"ok": True}

@api.get("/queue/today")
async def queue_today(user: dict = Depends(require_roles("medico"))):
    today = now_utc().date().isoformat()
    appts = await db.appointments.find({
        "doctor_id": user["id"],
        "scheduled_at": {"$regex": f"^{today}"}
    }, {"_id": 0}).sort([("priority", -1), ("scheduled_at", 1)]).to_list(200)
    priority_order = {"urgente": 0, "preferencial": 1, "normal": 2}
    appts.sort(key=lambda a: (priority_order.get(a.get("priority", "normal"), 2), a["scheduled_at"]))
    for a in appts:
        p = await db.patients.find_one({"id": a["patient_id"]}, {"_id": 0})
        a["patient"] = p or {}
    return appts

# ---------------- Prescriptions ----------------
@api.get("/prescriptions")
async def list_prescriptions(patient_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if patient_id: q["patient_id"] = patient_id
    if user["role"] == "medico" and not patient_id:
        q["doctor_id"] = user["id"]
    ps = await db.prescriptions.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return ps

@api.post("/prescriptions")
async def create_prescription(data: PrescriptionCreate, user: dict = Depends(require_roles("medico"))):
    # Safety lock: check active prescription for same active_substance
    existing = await db.prescriptions.find_one({
        "patient_id": data.patient_id,
        "active_substance": data.active_substance,
        "active": True,
    })
    if existing and not data.justification:
        raise HTTPException(409, {
            "error": "conflict",
            "message": f"Paciente já possui receita ativa para {data.active_substance}. Selecione uma justificativa para sobrepor.",
            "existing_id": existing["id"]
        })
    if existing and data.justification:
        await db.prescriptions.update_one({"id": existing["id"]}, {"$set": {"active": False, "superseded_at": iso(now_utc())}})

    pid = str(uuid.uuid4())
    validation_code = f"GOVBR-{uuid.uuid4().hex[:12].upper()}"
    doc = {"id": pid, **data.model_dump(), "doctor_id": user["id"], "doctor_name": user["name"],
           "doctor_crm": user.get("crm"), "created_at": iso(now_utc()),
           "active": True, "signed": True, "validation_code": validation_code,
           "adherence_logs": []}
    await db.prescriptions.insert_one(doc)
    await audit(user, "prescription.create", pid,
                {"medication": data.medication, "substance": data.active_substance,
                 "override": bool(data.justification)})
    doc.pop("_id", None)
    return doc

@api.post("/prescriptions/{pid}/intake")
async def log_intake(pid: str, data: MedIntakeConfirm, user: dict = Depends(get_current_user)):
    log = {"id": str(uuid.uuid4()), "scheduled_time": data.scheduled_time,
           "confirmed_at": iso(now_utc()), "user_id": user["id"]}
    await db.prescriptions.update_one({"id": pid}, {"$push": {"adherence_logs": log}})
    return log

# ---------------- Exams ----------------
@api.get("/exams")
async def list_exams(status: Optional[str] = None, patient_id: Optional[str] = None,
                     user: dict = Depends(get_current_user)):
    q = {}
    if status: q["status"] = status
    if patient_id: q["patient_id"] = patient_id
    exams = await db.exams.find(q, {"_id": 0}).sort("created_at", -1).to_list(300)
    for e in exams:
        p = await db.patients.find_one({"id": e["patient_id"]}, {"_id": 0, "name": 1, "cpf": 1})
        e["patient"] = p or {}
    return exams

@api.post("/exams")
async def request_exams(data: ExamRequest, user: dict = Depends(require_roles("medico"))):
    created = []
    for ex in data.exams:
        eid = str(uuid.uuid4())
        doc = {"id": eid, "patient_id": data.patient_id, "exam": ex,
               "preparation_notes": data.preparation_notes, "urgent": data.urgent,
               "status": "pendente", "requested_by": user["id"],
               "created_at": iso(now_utc()), "delivered_at": None}
        await db.exams.insert_one(doc)
        doc.pop("_id", None)
        created.append(doc)
    await audit(user, "exam.request", data.patient_id, {"exams": data.exams})
    return created

@api.patch("/exams/{eid}/status")
async def update_exam_status(eid: str, status: str, user: dict = Depends(require_roles("atendente", "admin"))):
    if status not in ["pendente", "pronto", "retirado"]:
        raise HTTPException(400, "Status inválido")
    upd = {"status": status}
    if status == "retirado":
        upd["delivered_at"] = iso(now_utc())
        upd["delivered_by"] = user["id"]
    await db.exams.update_one({"id": eid}, {"$set": upd})
    await audit(user, "exam.status", eid, {"status": status})
    return {"ok": True}

# ---------------- Waiting List / Vagas Ociosas ----------------
@api.get("/waiting-list")
async def waiting_list(specialty: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"status": "waiting"}
    if specialty: q["specialty"] = specialty
    wl = await db.waiting_list.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)
    for w in wl:
        p = await db.patients.find_one({"id": w["patient_id"]}, {"_id": 0, "name": 1})
        w["patient"] = p or {}
    return wl

@api.get("/vacancies/active")
async def active_vacancies(user: dict = Depends(get_current_user)):
    now = now_utc()
    vacs = await db.vacancies.find({"status": {"$in": ["notified", "waiting_response"]}}, {"_id": 0}).to_list(100)
    for v in vacs:
        deadline = datetime.fromisoformat(v["deadline"])
        remaining = int((deadline - now).total_seconds())
        v["remaining_seconds"] = max(remaining, 0)
        if remaining <= 0 and v["status"] == "waiting_response":
            # advance to next
            v["status"] = "expired"
            await db.vacancies.update_one({"id": v["id"]}, {"$set": {"status": "expired"}})
    return vacs

# ---------------- Dashboards ----------------
@api.get("/dashboard/secretario")
async def dashboard_secretario(user: dict = Depends(require_roles("secretario", "admin"))):
    total_appts = await db.appointments.count_documents({})
    faltas = await db.appointments.count_documents({"status": "faltou"})
    compareceu = await db.appointments.count_documents({"status": "compareceu"})
    exams_pending = await db.exams.count_documents({"status": "pendente"})
    exams_abandoned = await db.exams.count_documents({"status": "pronto"})
    total_patients = await db.patients.count_documents({})
    total_prescriptions = await db.prescriptions.count_documents({})

    # Absenteeism by specialty
    pipeline = [
        {"$group": {"_id": "$specialty",
                    "total": {"$sum": 1},
                    "faltas": {"$sum": {"$cond": [{"$eq": ["$status", "faltou"]}, 1, 0]}}}}
    ]
    by_specialty = []
    async for row in db.appointments.aggregate(pipeline):
        rate = (row["faltas"] / row["total"] * 100) if row["total"] else 0
        by_specialty.append({"specialty": row["_id"], "total": row["total"],
                             "faltas": row["faltas"], "absenteeism": round(rate, 1)})

    # Medication demand forecast
    med_pipeline = [
        {"$match": {"active": True}},
        {"$group": {"_id": "$medication", "count": {"$sum": 1}}}
    ]
    med_demand = []
    async for row in db.prescriptions.aggregate(med_pipeline):
        med_demand.append({"medication": row["_id"], "patients": row["count"]})
    med_demand.sort(key=lambda x: -x["patients"])

    # Unit ranking
    unit_pipeline = [
        {"$group": {"_id": "$unit",
                    "total": {"$sum": 1},
                    "faltas": {"$sum": {"$cond": [{"$eq": ["$status", "faltou"]}, 1, 0]}}}}
    ]
    units = []
    async for row in db.appointments.aggregate(unit_pipeline):
        rate = (row["faltas"] / row["total"] * 100) if row["total"] else 0
        units.append({"unit": row["_id"], "total": row["total"], "absenteeism": round(rate, 1)})
    units.sort(key=lambda x: x["absenteeism"])

    # NPS synthetic
    nps_scores = [random.randint(6, 10) for _ in range(50)]
    promoters = sum(1 for s in nps_scores if s >= 9)
    detractors = sum(1 for s in nps_scores if s <= 6)
    nps = round((promoters - detractors) / len(nps_scores) * 100)

    # Weekly attendance trend
    today = now_utc().date()
    weekly = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        ds = d.isoformat()
        total = await db.appointments.count_documents({"scheduled_at": {"$regex": f"^{ds}"}})
        f = await db.appointments.count_documents({"scheduled_at": {"$regex": f"^{ds}"}, "status": "faltou"})
        weekly.append({"date": ds, "total": total, "faltas": f, "compareceu": total - f})

    absenteeism_rate = round(faltas / total_appts * 100, 1) if total_appts else 0
    adherence_rate = round(compareceu / total_appts * 100, 1) if total_appts else 0

    return {
        "kpis": {
            "total_patients": total_patients,
            "total_appointments": total_appts,
            "absenteeism_rate": absenteeism_rate,
            "adherence_rate": adherence_rate,
            "exams_pending": exams_pending,
            "exams_abandoned": exams_abandoned,
            "total_prescriptions": total_prescriptions,
            "nps": nps,
        },
        "by_specialty": by_specialty,
        "med_demand": med_demand[:8],
        "unit_ranking": units,
        "weekly_trend": weekly,
    }

@api.get("/audit-logs")
async def audit_logs(user: dict = Depends(require_roles("secretario", "admin"))):
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(200)
    return logs

# ---------------- Reference Data (CID/TUSS/SIGTAP) ----------------
CID_MOCK = [
    {"code": "I10", "desc": "Hipertensão essencial (primária)"},
    {"code": "E11", "desc": "Diabetes mellitus tipo 2"},
    {"code": "F32", "desc": "Episódios depressivos"},
    {"code": "F41", "desc": "Transtornos ansiosos"},
    {"code": "J45", "desc": "Asma"},
    {"code": "K21", "desc": "Doença de refluxo gastroesofágico"},
    {"code": "M54", "desc": "Dorsalgia"},
    {"code": "N39", "desc": "Outros transtornos do trato urinário"},
]
TUSS_MOCK = [
    {"code": "10101012", "desc": "Consulta em consultório"},
    {"code": "10103011", "desc": "Consulta pré-natal"},
    {"code": "40202100", "desc": "Hemograma completo"},
    {"code": "40301974", "desc": "Glicemia de jejum"},
    {"code": "40304035", "desc": "Colesterol total"},
]
SIGTAP_MOCK = [
    {"code": "02.02.01.038-0", "desc": "Hemograma completo"},
    {"code": "02.02.01.014-9", "desc": "Glicemia em jejum"},
    {"code": "02.02.01.019-0", "desc": "Colesterol total"},
    {"code": "02.02.01.049-1", "desc": "Triglicerídeos"},
    {"code": "02.02.02.006-3", "desc": "Urina - EAS"},
    {"code": "02.05.02.014-4", "desc": "Eletrocardiograma"},
    {"code": "02.05.01.004-1", "desc": "Radiografia de tórax"},
    {"code": "02.11.06.008-8", "desc": "Ultrassonografia abdominal"},
]

@api.get("/refs/cid")
async def cid(q: str = ""):
    if not q: return CID_MOCK
    ql = q.lower()
    return [c for c in CID_MOCK if ql in c["code"].lower() or ql in c["desc"].lower()]

@api.get("/refs/tuss")
async def tuss(q: str = ""):
    if not q: return TUSS_MOCK
    ql = q.lower()
    return [c for c in TUSS_MOCK if ql in c["code"] or ql in c["desc"].lower()]

@api.get("/refs/sigtap")
async def sigtap(q: str = ""):
    if not q: return SIGTAP_MOCK
    ql = q.lower()
    return [c for c in SIGTAP_MOCK if ql in c["code"] or ql in c["desc"].lower()]

# ---------------- Seeding ----------------
async def refresh_vacancies():
    """Ensure there are always active vacancies for the demo panel."""
    await db.vacancies.delete_many({})
    patients = await db.patients.find({}, {"_id": 0}).to_list(30)
    if not patients:
        return
    specialties = ["Cardiologia", "Endocrinologia", "Clínica Geral"]
    units = ["UBS Central", "UBS Zona Sul", "UBS Zona Norte"]
    vacs = []
    for i in range(3):
        p = patients[10 + i]
        deadline = now_utc() + timedelta(minutes=random.randint(5, 28))
        vacs.append({"id": str(uuid.uuid4()), "patient_id": p["id"],
                     "patient_name": p["name"], "specialty": random.choice(specialties),
                     "unit": random.choice(units),
                     "notified_at": iso(now_utc() - timedelta(minutes=random.randint(1, 3))),
                     "deadline": iso(deadline), "status": "waiting_response"})
    await db.vacancies.insert_many(vacs)


async def seed():
    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@saudeconecta.gov.br")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email, "name": "Administrador SUS",
            "role": "admin", "password_hash": hash_pw(admin_pw),
            "created_at": iso(now_utc()), "active": True
        })
    # Default professionals
    defaults = [
        {"email": "medico@saudeconecta.gov.br", "name": "Dra. Ana Ribeiro", "role": "medico",
         "crm": "CRM-SP 12345", "specialty": "Clínica Geral", "unit": "UBS Central"},
        {"email": "cardio@saudeconecta.gov.br", "name": "Dr. Bruno Alves", "role": "medico",
         "crm": "CRM-SP 22333", "specialty": "Cardiologia", "unit": "UBS Zona Sul"},
        {"email": "atendente@saudeconecta.gov.br", "name": "Marta Silva", "role": "atendente",
         "unit": "UBS Central"},
        {"email": "secretario@saudeconecta.gov.br", "name": "Carlos Mendes", "role": "secretario"},
    ]
    for u in defaults:
        if not await db.users.find_one({"email": u["email"]}):
            u2 = {**u, "id": str(uuid.uuid4()), "password_hash": hash_pw("senha123"),
                  "created_at": iso(now_utc()), "active": True}
            await db.users.insert_one(u2)

    if await db.patients.count_documents({}) > 0:
        await refresh_vacancies()
        return  # already seeded

    # Patients
    nomes = ["João Souza", "Maria Oliveira", "Pedro Santos", "Ana Costa", "Luiza Pereira",
             "Carlos Lima", "Beatriz Fernandes", "Rafael Almeida", "Sofia Rodrigues",
             "Miguel Barbosa", "Camila Nunes", "Lucas Martins", "Isabela Ramos",
             "Gustavo Duarte", "Helena Cardoso", "Tiago Ferreira", "Larissa Melo",
             "Diego Araújo", "Patrícia Rocha", "Fernando Castro"]
    patients = []
    for i, n in enumerate(nomes):
        pid = str(uuid.uuid4())
        p = {"id": pid, "name": n, "cpf": f"{100+i:03d}.{200+i:03d}.{300+i:03d}-{i:02d}",
             "birth_date": f"19{50 + (i % 40)}-{(i % 12) + 1:02d}-{(i % 27) + 1:02d}",
             "phone": f"(11) 9{8000 + i:04d}-{1000+i:04d}",
             "address": f"Rua das Flores, {i * 10 + 1} — São Paulo/SP",
             "lgpd_accepted": i % 5 != 0, "active": True,
             "missed_count": (2 if i % 7 == 0 else 0),
             "blocked_online": (i % 7 == 0),
             "created_at": iso(now_utc())}
        patients.append(p)
    await db.patients.insert_many(patients)

    medicos = await db.users.find({"role": "medico"}, {"_id": 0}).to_list(10)
    specialties = ["Clínica Geral", "Cardiologia", "Endocrinologia", "Psiquiatria", "Pneumologia"]
    units = ["UBS Central", "UBS Zona Sul", "UBS Zona Norte"]
    priorities = ["normal", "normal", "normal", "preferencial", "urgente"]
    statuses = ["aguardando", "compareceu", "compareceu", "compareceu", "faltou", "faltou"]

    # Appointments (past 7 days + today)
    today = now_utc().date()
    appts = []
    for day_offset in range(-6, 3):
        d = today + timedelta(days=day_offset)
        for i, p in enumerate(patients[:15]):
            hour = 8 + (i % 8)
            m = medicos[i % len(medicos)]
            appts.append({
                "id": str(uuid.uuid4()),
                "patient_id": p["id"], "doctor_id": m["id"],
                "specialty": m.get("specialty", random.choice(specialties)),
                "scheduled_at": f"{d.isoformat()}T{hour:02d}:00:00",
                "priority": random.choice(priorities),
                "unit": m.get("unit", random.choice(units)),
                "status": "aguardando" if day_offset >= 0 else random.choice(statuses),
                "checked_in": day_offset == 0 and i % 3 == 0,
                "created_at": iso(now_utc()),
            })
    await db.appointments.insert_many(appts)

    # Prescriptions
    meds = [
        ("Losartana 50mg", "Losartana Potássica", "1 comprimido", "1x ao dia", 30, ["08:00"]),  # kept for future
        ("Metformina 850mg", "Metformina", "1 comprimido", "2x ao dia", 30, ["08:00", "20:00"]),
        ("Fluoxetina 20mg", "Fluoxetina", "1 cápsula", "1x ao dia", 30, ["08:00"]),
        ("Clonazepam 2mg", "Clonazepam", "1 comprimido", "1x ao dia", 30, ["22:00"]),
        ("Omeprazol 20mg", "Omeprazol", "1 cápsula", "1x ao dia", 30, ["07:00"]),
        ("Sinvastatina 20mg", "Sinvastatina", "1 comprimido", "1x ao dia", 30, ["21:00"]),
        ("Levotiroxina 50mcg", "Levotiroxina Sódica", "1 comprimido", "1x ao dia", 30, ["06:30"]),
    ]
    prescs = []
    for i, p in enumerate(patients):
        med = meds[i % len(meds)]
        m = medicos[i % len(medicos)]
        logs = []
        for d in range(1, 8):
            if random.random() > 0.15:
                logs.append({"id": str(uuid.uuid4()),
                             "scheduled_time": med[5][0],
                             "confirmed_at": iso(now_utc() - timedelta(days=d))})
        prescs.append({
            "id": str(uuid.uuid4()), "patient_id": p["id"], "doctor_id": m["id"],
            "doctor_name": m["name"], "doctor_crm": m.get("crm"),
            "medication": med[0], "active_substance": med[1], "dosage": med[2],
            "frequency": med[3], "duration_days": med[4], "route": "Oral",
            "schedule": med[5], "created_at": iso(now_utc() - timedelta(days=random.randint(1, 60))),
            "active": True, "signed": True,
            "validation_code": f"GOVBR-{uuid.uuid4().hex[:12].upper()}",
            "adherence_logs": logs
        })
    await db.prescriptions.insert_many(prescs)

    # Exams
    exam_types = ["Hemograma completo", "Glicemia em jejum", "Colesterol total", "Eletrocardiograma", "Ultrassonografia abdominal"]
    exams = []
    for i, p in enumerate(patients[:16]):
        for _ in range(random.randint(1, 2)):
            s = random.choice(["pendente", "pronto", "pronto", "retirado"])
            e = {"id": str(uuid.uuid4()), "patient_id": p["id"],
                 "exam": random.choice(exam_types),
                 "preparation_notes": "Jejum de 12h" if random.random() > 0.5 else None,
                 "urgent": random.random() < 0.2,
                 "status": s, "requested_by": medicos[0]["id"],
                 "created_at": iso(now_utc() - timedelta(days=random.randint(1, 20))),
                 "delivered_at": iso(now_utc()) if s == "retirado" else None}
            exams.append(e)
    await db.exams.insert_many(exams)

    # Waiting list
    wl = []
    for i, p in enumerate(patients[10:18]):
        wl.append({"id": str(uuid.uuid4()), "patient_id": p["id"],
                   "specialty": random.choice(specialties), "status": "waiting",
                   "created_at": iso(now_utc() - timedelta(days=random.randint(1, 30)))})
    await db.waiting_list.insert_many(wl)

    # Active vacancies (simulate real-time)
    await refresh_vacancies()

    logger.info("Seed complete.")

# ---------------- App wiring ----------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.patients.create_index("cpf", unique=True)
    await seed()
    # write test credentials
    Path("/app/memory").mkdir(exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("""# SaúdeConecta — Credenciais de Teste

| Perfil | Email | Senha |
|---|---|---|
| Admin | admin@saudeconecta.gov.br | admin123 |
| Médico (Clínica Geral) | medico@saudeconecta.gov.br | senha123 |
| Médico (Cardiologia) | cardio@saudeconecta.gov.br | senha123 |
| Atendente | atendente@saudeconecta.gov.br | senha123 |
| Secretário de Saúde | secretario@saudeconecta.gov.br | senha123 |

## Endpoints
- POST /api/auth/login
- GET  /api/auth/me
- POST /api/auth/logout
""")

@app.on_event("shutdown")
async def shutdown():
    client.close()
