"""定時工作。與 API 同一個程序,所以 Uvicorn 只能開一個 worker。"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.adapters.clock import SystemClock
from app.adapters.push.expo import ExpoPushSender
from app.adapters.sqlite.reminders import SqliteReminderStore
from app.application.reminders import ReminderService
from app.config import settings
from app.db import get_conn

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def dispatch_reminders() -> None:
    """每分鐘跑一次。這裡出事不該拖垮 API,所以記一行就好,不讓 traceback 洗版。"""
    try:
        async with get_conn() as conn:
            service = ReminderService(
                SqliteReminderStore(conn),
                ExpoPushSender(settings.expo_access_token),
                SystemClock(),
            )
            await service.dispatch_due()
    except Exception as e:
        log.warning("提醒推播這一輪失敗:%s", e)


scheduler.add_job(
    dispatch_reminders,
    CronTrigger(minute="*"),
    id="morning-weigh-in",
    replace_existing=True,
    max_instances=1,
)
