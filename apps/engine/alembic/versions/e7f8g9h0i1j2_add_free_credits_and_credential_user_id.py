"""add_free_credits_and_credential_user_id

Revision ID: e7f8g9h0i1j2
Revises: b0f8c8310273
Create Date: 2026-07-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'e7f8g9h0i1j2'
down_revision: Union[str, Sequence[str], None] = 'b0f8c8310273'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add free_credits column to users
    op.add_column('users', sa.Column('free_credits', sa.Integer(), nullable=False, server_default=sa.text('50')))

    # 2. Add user_id column and foreign key to credentials
    op.add_column('credentials', sa.Column('user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f('ix_credentials_user_id'), 'credentials', ['user_id'], unique=False)
    op.create_foreign_key('fk_credentials_user_id_users', 'credentials', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_credentials_user_id_users', 'credentials', type_='foreignkey')
    op.drop_index(op.f('ix_credentials_user_id'), table_name='credentials')
    op.drop_column('credentials', 'user_id')
    op.drop_column('users', 'free_credits')
