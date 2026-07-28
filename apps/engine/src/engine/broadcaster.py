import json
import logging
from typing import Any, Dict
import redis.asyncio as aioredis
from config import settings

logger = logging.getLogger("engine.broadcaster")

class EventBroadcaster:
    def __init__(self):
        self.redis_client = None

    async def get_client(self):
        if not self.redis_client:
            self.redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self.redis_client

    async def publish_event(self, run_id: str, event_type: str, data: Dict[str, Any], workflow_id: str = None):
        """Publish execution event to Redis pubsub channels: execution:{run_id} and workflow:{workflow_id}"""
        try:
            client = await self.get_client()
            message = json.dumps({
                "event": event_type,
                "data": data
            })
            await client.publish(f"execution:{run_id}", message)
            
            wf_id = workflow_id or data.get("workflow_id")
            if wf_id:
                await client.publish(f"workflow:{wf_id}", message)
        except Exception as e:
            logger.error(f"Failed to publish event for run {run_id}: {e}")

    async def close(self):
        if self.redis_client:
            await self.redis_client.close()

broadcaster = EventBroadcaster()
