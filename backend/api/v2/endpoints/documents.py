from __future__ import annotations

import base64
from io import BytesIO

from fastapi import APIRouter, Body, Depends, File, HTTPException, Path, UploadFile
from PIL import Image, UnidentifiedImageError

from backend.api.dependencies import get_engine
from backend.database.repositories.documents_repository import DocumentsRepository
from backend.models.api import ApiDeleteResponse, ApiListResponse, ApiResponse
from backend.models.documents import (
    DocumentBlobResponse,
    DocumentCreateRequest,
    DocumentDeleteRequest,
    DocumentResponse,
    DocumentSummaryResponse,
)
from backend.services.file_naming import validate_document_name


router = APIRouter(tags=["documents-v2"])


def _response_payload(row: dict[str, object], *, include_blob: bool) -> dict[str, object]:
    payload = dict(row)
    blob = payload.pop("blob", None)
    payload["blob_base64"] = (
        base64.b64encode(blob).decode("ascii")
        if include_blob and isinstance(blob, bytes)
        else None
    )
    return payload


@router.get(
    "/api/v2/documents",
    response_model=ApiListResponse[DocumentSummaryResponse],
)
def list_documents(engine=Depends(get_engine)):
    rows = DocumentsRepository(engine).list()
    items = [DocumentSummaryResponse.model_validate(row) for row in rows]
    return ApiListResponse(message="Documents retrieved.", items=items, count=len(items))


@router.get(
    "/api/v2/documents/{document_id}",
    response_model=ApiResponse[DocumentResponse],
)
def get_document(
    document_id: str = Path(..., min_length=1),
    engine=Depends(get_engine),
):
    row = DocumentsRepository(engine).fetch(document_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return ApiResponse(
        message="Document retrieved.",
        data=DocumentResponse.model_validate(_response_payload(row, include_blob=True)),
    )


@router.post(
    "/api/v2/documents",
    response_model=ApiResponse[DocumentResponse],
)
def create_document(
    payload: DocumentCreateRequest,
    engine=Depends(get_engine),
):
    try:
        document_id = validate_document_name(payload.id or payload.name)
        document_name = validate_document_name(payload.name)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if document_id != document_name:
        raise HTTPException(status_code=400, detail="Document id and name must match")

    repository = DocumentsRepository(engine)
    repository.ensure(document_id, metadata=payload.metadata)
    row = repository.fetch(document_id)
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to load document after create")
    return ApiResponse(
        message="Document created.",
        data=DocumentResponse.model_validate(_response_payload(row, include_blob=False)),
    )


@router.put(
    "/api/v2/documents/{document_id}/blob",
    response_model=ApiResponse[DocumentBlobResponse],
)
async def upload_document_blob(
    document_id: str = Path(..., min_length=1),
    engine=Depends(get_engine),
    file: UploadFile = File(...),
):
    repository = DocumentsRepository(engine)
    if repository.fetch(document_id) is None:
        raise HTTPException(status_code=404, detail="Document not found")
    blob = await file.read()
    if not blob:
        raise HTTPException(status_code=400, detail="Document file is empty")
    if not blob.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Document file must be a PDF")
    if repository.update_blob(
        document_id,
        blob=blob,
        mime_type="application/pdf",
        source="uploaded",
    ) != 1:
        raise HTTPException(status_code=409, detail="Failed to update document PDF")
    return ApiResponse(
        message="Document PDF uploaded.",
        data=DocumentBlobResponse(id=document_id),
    )


@router.post(
    "/api/v2/documents/{document_id}/assemble",
    response_model=ApiResponse[DocumentBlobResponse],
)
def assemble_document_pdf(
    document_id: str = Path(..., min_length=1),
    engine=Depends(get_engine),
):
    repository = DocumentsRepository(engine)
    if repository.fetch(document_id) is None:
        raise HTTPException(status_code=404, detail="Document not found")
    pages = repository.page_blobs(document_id)
    if not pages:
        raise HTTPException(status_code=400, detail="Document has no sample pages")

    images: list[Image.Image] = []
    try:
        for page in pages:
            blob = page.get("blob")
            if not isinstance(blob, bytes) or not blob:
                raise HTTPException(
                    status_code=400,
                    detail=f"Sample has no image blob: {page['id']}",
                )
            try:
                with Image.open(BytesIO(blob)) as source:
                    images.append(source.convert("RGB"))
            except (UnidentifiedImageError, OSError) as error:
                raise HTTPException(
                    status_code=400,
                    detail=f"Sample is not a supported image: {page['id']}",
                ) from error

        output = BytesIO()
        images[0].save(
            output,
            format="PDF",
            save_all=True,
            append_images=images[1:],
        )
        pdf_blob = output.getvalue()
    finally:
        for image in images:
            image.close()

    if repository.update_blob(
        document_id,
        blob=pdf_blob,
        mime_type="application/pdf",
        source="assembled",
    ) != 1:
        raise HTTPException(status_code=409, detail="Failed to save assembled PDF")
    return ApiResponse(
        message="Document PDF assembled from sample images.",
        data=DocumentBlobResponse(id=document_id),
    )


@router.delete(
    "/api/v2/documents/{document_id}",
    response_model=ApiDeleteResponse,
)
def delete_document(
    document_id: str = Path(..., min_length=1),
    engine=Depends(get_engine),
):
    repository = DocumentsRepository(engine)
    if repository.fetch(document_id) is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        deleted = repository.delete(document_id)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if deleted != 1:
        raise HTTPException(status_code=409, detail="Failed to delete document")
    return ApiDeleteResponse(message="Document deleted.")


@router.delete("/api/v2/documents", response_model=ApiDeleteResponse)
def delete_documents(
    payload: DocumentDeleteRequest = Body(...),
    engine=Depends(get_engine),
):
    ids = list(dict.fromkeys(value.strip() for value in payload.ids if value.strip()))
    if not ids:
        raise HTTPException(status_code=400, detail="ids is required")
    repository = DocumentsRepository(engine)
    try:
        for document_id in ids:
            if repository.fetch(document_id) is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Document not found: {document_id}",
                )
            repository.delete(document_id)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return ApiDeleteResponse(message="Documents deleted.")
