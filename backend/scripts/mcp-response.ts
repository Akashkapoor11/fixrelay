/** Parse MCP JSON or SSE responses and bind the response to its originating JSON-RPC ID. */
export function parseMcpPayload(text: string, contentType: string, expectedId?: string | number): unknown {
  let body: unknown;
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (mediaType === 'application/json') {
    try { body = JSON.parse(text); } catch { throw new Error('MCP JSON response was not valid JSON.'); }
  } else if (mediaType === 'text/event-stream') {
    const events = text.split(/\r?\n\r?\n/);
    const candidates: unknown[] = [];
    for (const event of events) {
      const lines = event.split(/\r?\n/).filter((line) => line.startsWith('data:'));
      if (!lines.length) continue;
      const data = lines.map((line) => line.slice(5).replace(/^ /, '')).join('\n').trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed: unknown = JSON.parse(data);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        const envelope = parsed as Record<string, unknown>;
        if (expectedId !== undefined) {
          if (envelope.id === expectedId && ('result' in envelope || 'error' in envelope)) { body = parsed; break; }
        } else if ('id' in envelope && ('result' in envelope || 'error' in envelope)) {
          candidates.push(parsed);
        }
      } catch { /* Ignore keep-alive, heartbeat, or malformed SSE frames. */ }
    }
    if (body === undefined && candidates.length) body = candidates[candidates.length - 1];
    if (body === undefined) throw new Error(expectedId === undefined
      ? 'MCP event stream did not contain a JSON-RPC response.'
      : `MCP event stream did not contain a JSON-RPC response for id ${String(expectedId)}.`);
  } else {
    throw new Error(`Unsupported MCP response content type: ${contentType || '(missing)'}`);
  }

  if (expectedId !== undefined) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('MCP response is not a JSON-RPC object.');
    const envelope = body as Record<string, unknown>;
    if (envelope.jsonrpc !== '2.0' || envelope.id !== expectedId || (!('result' in envelope) && !('error' in envelope))) {
      throw new Error(`MCP JSON-RPC response did not match request id ${String(expectedId)}.`);
    }
  }
  return body;
}
