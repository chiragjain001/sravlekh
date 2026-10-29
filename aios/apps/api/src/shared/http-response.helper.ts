/**
 * Adapts binary/stream downloads so controllers remain completely agnostic
 * to whether the underlying NestJS HTTP adapter is Express or Fastify.
 */
export function sendBinaryDownload(
  res: any,
  buffer: Buffer,
  filename: string,
  contentType: string,
): void {
  const headers: Record<string, string | number> = {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length,
  };

  if (typeof res.headers === 'function' && typeof res.send === 'function') {
    // Fastify FastifyReply
    res.headers(headers);
    res.send(buffer);
  } else if (typeof res.header === 'function' && typeof res.send === 'function') {
    // Fastify single header
    for (const [k, v] of Object.entries(headers)) {
      res.header(k, v);
    }
    res.send(buffer);
  } else if (typeof res.set === 'function' && typeof res.end === 'function') {
    // Express Response
    res.set(headers);
    res.end(buffer);
  } else {
    throw new Error('Unsupported HTTP response object');
  }
}
