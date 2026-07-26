import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger("engine.websocket")
router = APIRouter(tags=["WebSockets"])

@router.websocket("/ws/executions/{run_id}")
async def execution_websocket(websocket: WebSocket, run_id: str):
    await websocket.accept()
    channel_name = f"execution:{run_id}"
    
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel_name)

    async def listen_redis():
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await websocket.send_text(message["data"])
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in Redis listener: {e}")

    listener_task = asyncio.create_task(listen_redis())

    try:
        while True:
            # Keep connection alive, listen for ping/messages from client
            client_msg = await websocket.receive_text()
            if client_msg == "ping":
                await websocket.send_text('{"event": "pong"}')
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for run {run_id}")
    finally:
        listener_task.cancel()
        await pubsub.unsubscribe(channel_name)
        await redis_client.close()
