import httpx

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BATCH_SIZE = 100


class ExpoPushSender:
    def __init__(self, access_token: str = "") -> None:
        self._headers = {"Content-Type": "application/json"}
        if access_token:
            self._headers["Authorization"] = f"Bearer {access_token}"

    async def send(self, tokens: tuple[str, ...], title: str, body: str) -> None:
        if not tokens:
            return
        async with httpx.AsyncClient(timeout=10) as client:
            for start in range(0, len(tokens), BATCH_SIZE):
                batch = tokens[start : start + BATCH_SIZE]
                await client.post(
                    EXPO_PUSH_URL,
                    headers=self._headers,
                    json=[{"to": t, "title": title, "body": body} for t in batch],
                )
