from fastapi import APIRouter, Depends, HTTPException
from typing import List
from pydantic import BaseModel
from src.auth import get_current_user, require_role
from src.database import db

router = APIRouter(prefix="/institutes", tags=["Institutes"])

@router.get("/")
async def get_my_institute(current_user = Depends(get_current_user)):
    """Get the institute details for the logged-in user"""
    if not current_user.instituteId:
        raise HTTPException(status_code=404, detail="User not associated with any institute")
        
    institute = await db.institute.find_unique(
        where={"id": current_user.instituteId}
    )
    if not institute:
        raise HTTPException(status_code=404, detail="Institute not found")
        
    return institute

# --- Hierarchy: Subjects ---

@router.get("/{institute_id}/subjects")
async def get_subjects(institute_id: str, current_user = Depends(get_current_user)):
    """List all subjects for the institute"""
    # Enforce tenant isolation
    if current_user.instituteId != institute_id and current_user.role != "FOUNDER":
        raise HTTPException(status_code=403, detail="Forbidden access to this institute")
        
    subjects = await db.subject.find_many(
        where={"instituteId": institute_id},
        include={"chapters": True}
    )
    return subjects

# --- Hierarchy: Batches ---

@router.get("/{institute_id}/batches")
async def get_batches(institute_id: str, current_user = Depends(get_current_user)):
    """List all batches for the institute"""
    if current_user.instituteId != institute_id and current_user.role != "FOUNDER":
        raise HTTPException(status_code=403, detail="Forbidden access to this institute")
        
    batches = await db.batch.find_many(
        where={"instituteId": institute_id}
    )
    return batches
