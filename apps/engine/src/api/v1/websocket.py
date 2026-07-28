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
    try:
        await websocket.send_json({"event": "connected", "data": {"run_id": run_id}})
    except Exception:
        pass

    channel_name = f"execution:{run_id}"
    redis_client = None
    pubsub = None
    listener_task = None

    try:
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
                logger.error(f"Error in Redis listener for run {run_id}: {e}")

        listener_task = asyncio.create_task(listen_redis())

        while True:
            client_msg = await websocket.receive_text()
            if client_msg == "ping":
                await websocket.send_text('{"event": "pong"}')
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for run {run_id}")
    except Exception as e:
        logger.error(f"WebSocket error for run {run_id}: {e}")
    finally:
        if listener_task and not listener_task.done():
            listener_task.cancel()
        if pubsub:
            try:
                await pubsub.unsubscribe(channel_name)
            except Exception:
                pass
        if redis_client:
            try:
                await redis_client.close()
            except Exception:
                pass

@router.websocket("/ws/workflows/{workflow_id}")
async def workflow_websocket(websocket: WebSocket, workflow_id: str):
    await websocket.accept()
    try:
        await websocket.send_json({"event": "connected", "data": {"workflow_id": workflow_id}})
    except Exception:
        pass

    channel_name = f"workflow:{workflow_id}"
    redis_client = None
    pubsub = None
    listener_task = None

    try:
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
                logger.error(f"Error in Redis listener for workflow {workflow_id}: {e}")

        listener_task = asyncio.create_task(listen_redis())

        while True:
            client_msg = await websocket.receive_text()
            if client_msg == "ping":
                await websocket.send_text('{"event": "pong"}')
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for workflow {workflow_id}")
    except Exception as e:
        logger.error(f"WebSocket error for workflow {workflow_id}: {e}")
    finally:
        if listener_task and not listener_task.done():
            listener_task.cancel()
        if pubsub:
            try:
                await pubsub.unsubscribe(channel_name)
            except Exception:
                pass
        if redis_client:
            try:
                await redis_client.close()
            except Exception:
                pass
