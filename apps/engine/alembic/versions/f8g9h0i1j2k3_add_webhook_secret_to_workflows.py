"""add_webhook_secret_to_workflows

Revision ID: f8g9h0i1j2k3
Revises: e7f8g9h0i1j2
Create Date: 2026-07-27 13:00:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'f8g9h0i1j2k3'
down_revision: Union[str, Sequence[str], None] = 'e7f8g9h0i1j2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add nullable webhook_secret column first
    op.add_column('workflows', sa.Column('webhook_secret', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    
    # 2. Populate default secrets for existing rows
    conn = op.get_bind()
    results = conn.execute(sa.text("SELECT id FROM workflows")).fetchall()
    for row in results:
        sec = f"wf_sec_{uuid.uuid4().hex}"
        conn.execute(sa.text("UPDATE workflows SET webhook_secret = :sec WHERE id = :id"), {"sec": sec, "id": row[0]})

    # 3. Make column non-nullable and add index
    op.alter_column('workflows', 'webhook_secret', nullable=False)
    op.create_index(op.f('ix_workflows_webhook_secret'), 'workflows', ['webhook_secret'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_workflows_webhook_secret'), table_name='workflows')
    op.drop_column('workflows', 'webhook_secret')
