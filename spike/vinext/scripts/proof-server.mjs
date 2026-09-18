import net from 'node:net';
import { pathToFileURL } from 'node:url';

export async function assertPortAvailable(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, resolve);
  });
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

export async function readOwnedResponse(url, token, pid) {
  process.kill(pid, 0);
  const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
  process.kill(pid, 0);
  if (!response.ok || response.headers.get('x-spike-proof-run') !== token) {
    throw new Error('Response is not from this proof run');
  }
  return response.text();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] === 'port') {
      await assertPortAvailable(Number(process.argv[3]));
    } else {
      console.log(await readOwnedResponse(process.argv[3], process.argv[4], Number(process.argv[5])));
    }
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
