/**
 * Stream Error Wrapper
 *
 * Wraps a text stream response so that if an error occurred during streaming,
 * an `e:` error frame is appended after the stream ends. The frontend's
 * use-chat.ts hook already handles `e:` prefixed lines as stream errors.
 */

/**
 * Wrap a streaming Response with error-frame injection.
 *
 * @param response  The original streaming response (from `toTextStreamResponse()`)
 * @param getStreamError  Called after the original stream ends; if it returns
 *                        a non-null string, an error frame is appended.
 */
export function wrapStreamWithErrorFrame(
  response: Response,
  getStreamError: () => string | null
): Response {
  if (!response.body) return response;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const reader = response.body.getReader();

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch {
      // Original stream errored or client disconnected
    } finally {
      // Wrap writer operations — if client disconnected, writer is already
      // aborted and write/close will throw. Catch silently.
      try {
        const error = getStreamError();
        if (error) {
          const errorFrame = `e:${JSON.stringify({ message: 'Stream error from AI model. Please try again.' })}\n`;
          await writer.write(new TextEncoder().encode(errorFrame));
        }
        await writer.close();
      } catch {
        // Client disconnected — writer already aborted, nothing to do
      }
    }
  })();

  return new Response(readable, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
