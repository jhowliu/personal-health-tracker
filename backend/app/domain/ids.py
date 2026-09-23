"""UUID v7: the first 48 bits are a millisecond timestamp, so ids sort by creation
time out of the box — which is what we want from a primary key.
"""

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
