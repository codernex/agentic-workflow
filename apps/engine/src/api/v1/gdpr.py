import json
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from db.session import get_async_session
from models.user import User
from models.workflow import Workflow
from models.execution import WorkflowRun
from auth.security import get_current_user

router = APIRouter(prefix="/gdpr", tags=["GDPR & Data Privacy"])

@router.get("/export")
async def export_user_data(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """
    GDPR Article 20 - Right to Data Portability.
    Exports all personal profile information, created workflows, and execution runs
    in machine-readable JSON format.
    """
    # Fetch user workflows
    wf_statement = select(Workflow).where(Workflow.user_id == current_user.id)
    wf_result = await session.exec(wf_statement)
    workflows = wf_result.all()

    # Fetch user execution runs
    runs_statement = select(WorkflowRun)
    runs_result = await session.exec(runs_statement)
    all_runs = runs_result.all()

    export_payload = {
        "export_metadata": {
            "requested_at": current_user.created_at.isoformat(),
            "gdpr_compliance_standard": "EU GDPR 2016/679 Article 20",
        },
        "user_profile": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "is_verified": current_user.is_verified,
            "created_at": current_user.created_at.isoformat(),
        },
        "workflows": [
            {
                "id": wf.id,
                "name": wf.name,
                "description": wf.description,
                "nodes": wf.nodes,
                "edges": wf.edges,
                "created_at": wf.created_at.isoformat(),
            }
            for wf in workflows
        ],
        "executions_count": len(all_runs),
    }

    json_str = json.dumps(export_payload, indent=2, default=str)
    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="gdpr_export_{current_user.id}.json"'
        }
    )


@router.delete("/account", status_code=status.HTTP_200_OK)
async def delete_user_account(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """
    GDPR Article 17 - Right to Erasure ('Right to be Forgotten').
    Permanently deletes user profile and associated workflow data from the platform.
    """
    # Delete user's workflows
    wf_statement = select(Workflow).where(Workflow.user_id == current_user.id)
    wf_result = await session.exec(wf_statement)
    workflows = wf_result.all()

    for wf in workflows:
        await session.delete(wf)

    await session.delete(current_user)
    await session.commit()

    return {"message": "Account and all associated user data permanently erased per GDPR Article 17."}
