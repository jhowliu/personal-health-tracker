"""UUID v7:前 48 bit 是毫秒時間戳,產生出來就依時間排序,適合當主鍵。"""

import os
import time
import uuid


def new_id() -> str:
    ms = int(time.time() * 1000) & 0xFFFFFFFFFFFF
    rand = os.urandom(10)
    value = (
        (ms << 80)
        | (0x7 << 76)
        | ((rand[0] & 0x0F) << 72)
        | (rand[1] << 64)
        | (0b10 << 62)
        | (int.from_bytes(rand[2:], "big") & ((1 << 62) - 1))
    )
    return str(uuid.UUID(int=value))
