/**
 * Релей уведомлений: Cloudflare Worker, который принимает событие от сервера
 * и пересылает его в Telegram.
 *
 * Зачем: с российского хостинга api.telegram.org недоступен, а Worker живёт
 * в сети Cloudflare, откуда доступен. Сервер шлёт POST сюда, Worker — в Telegram.
 *
 * Развернуть (10 минут, бесплатно):
 *   1. dash.cloudflare.com → Workers & Pages → Create → Worker → вставить этот файл.
 *   2. Settings → Variables:
 *        BOT_TOKEN  — токен бота (Secret)
 *        CHAT_ID    — id чата
 *        RELAY_KEY  — любая длинная строка (Secret): без неё в чат сможет писать кто угодно,
 *                     кто узнает адрес воркера.
 *   3. Deploy, скопировать адрес вида https://имя.логин.workers.dev
 *   4. На сервере в /etc/360profi.env:
 *        WEBHOOK_URL=https://имя.логин.workers.dev/?key=RELAY_KEY
 *      и systemctl restart 360profi-api
 *
 * Проверить: curl -X POST "https://.../?key=..." -H 'content-type: application/json' \
 *              -d '{"kind":"defect","text":"проверка связи"}'
 */

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 });
    }

    // Ключ в адресе — единственная защита воркера: без него любой, кто узнает
    // адрес, сможет слать сообщения в рабочий чат.
    const key = new URL(request.url).searchParams.get('key');
    if (!env.RELAY_KEY || key !== env.RELAY_KEY) {
      return new Response('forbidden', { status: 403 });
    }

    let event;
    try {
      event = await request.json();
    } catch {
      return new Response('bad json', { status: 400 });
    }

    const text = [event.text, event.url].filter(Boolean).join('\n');
    if (!text) return new Response('empty', { status: 400 });

    const answer = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.CHAT_ID,
        text,
        disable_web_page_preview: true
      })
    });

    // Ответ телеграма отдаём как есть: по нему видно, что не так с токеном или чатом.
    return new Response(await answer.text(), {
      status: answer.status,
      headers: { 'content-type': 'application/json' }
    });
  }
};
