
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.auth import get_current_user, require_role
from src.database import db

router = APIRouter(prefix="/institutes/{institute_id}", tags=["Users"])

class CreateStudentDto(BaseModel):
    name: str
    email: str
    batchId: str
    enrollmentNo: str | None = None

class CreateTeacherDto(BaseModel):
    name: str
    email: str
    subjectIds: list[str] = []

@router.get("/students")
async def get_students(
    institute_id: str, 
    batchId: str | None = None,
    current_user = Depends(get_current_user)
):
    if current_user.instituteId != institute_id and current_user.role != "FOUNDER":
        raise HTTPException(status_code=403, detail="Forbidden access to this institute")

    where = {"user": {"instituteId": institute_id}}
    if batchId:
        where["batchId"] = batchId

    students = await db.studentprofile.find_many(
        where=where,
        include={
            "user": True,
            "batch": True
        }
    )
    
    # Flatten the response structure to match the NestJS output if needed, or rely on frontend to parse.
    # The frontend expects { id, userId, batchId, user: { name, email }, batch: { name } }
    # Prisma Python returns this structure natively as nested objects.
    
    return {"data": [s.model_dump() for s in students]}

@router.post("/students", dependencies=[Depends(require_role(["ADMIN", "FOUNDER"]))])
async def create_student(institute_id: str, dto: CreateStudentDto, current_user = Depends(get_current_user)):
    if current_user.instituteId != institute_id and current_user.role != "FOUNDER":
        raise HTTPException(status_code=403, detail="Forbidden access to this institute")

    # In Python, we have to perform the same transactional user creation.
    # We would use db.tx() but for simplicity we can just create user then profile.
    # Actually, prisma-python supports nested writes!
    
    new_user = await db.user.create(
        data={
            "email": dto.email,
            "name": dto.name,
            "role": "STUDENT",
            "instituteId": institute_id,
            "studentProfile": {
                "create": {
                    "batchId": dto.batchId,
                    "enrollmentNo": dto.enrollmentNo
                }
            }
        },
        include={"studentProfile": True}
    )
    
    return new_user

@router.get("/teachers")
async def get_teachers(institute_id: str, current_user = Depends(get_current_user)):
    if current_user.instituteId != institute_id and current_user.role != "FOUNDER":
        raise HTTPException(status_code=403, detail="Forbidden")

    teachers = await db.teacherprofile.find_many(
        where={"user": {"instituteId": institute_id}},
        include={
            "user": True,
            "subjects": {"include": {"subject": True}}
        }
    )
    return {"data": [t.model_dump() for t in teachers]}
