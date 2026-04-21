import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.models import Document, OcrStatus
from ..routers.deps import get_current_user
from ..schemas.schemas import DocumentOut
from ..services.storage_service import download_file, get_presigned_url, upload_file

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"
}
MAX_SIZE = 10 * 1024 * 1024  # 10 Mo


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type de fichier non supporté. Formats acceptés : JPG, PNG, WEBP, PDF",
        )

    file_data = file.file.read()
    if len(file_data) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fichier trop volumineux (max 10 Mo)",
        )

    storage_path = f"documents/{current_user.id}/{uuid.uuid4()}/{file.filename}"
    upload_file(file_data, storage_path, file.content_type)

    doc = Document(
        original_filename=file.filename,
        storage_path=storage_path,
        mime_type=file.content_type,
        file_size=len(file_data),
        ocr_status=OcrStatus.COMPLETED,  # pas d'OCR, prêt immédiatement
        ocr_data=None,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return doc


@router.get("/{document_id}/url")
def get_document_url(document_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return {"url": get_presigned_url(doc.storage_path)}


@router.get("/{document_id}/file")
def download_document(document_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    data = download_file(doc.storage_path)
    return Response(
        content=data,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'inline; filename="{doc.original_filename}"'},
    )
