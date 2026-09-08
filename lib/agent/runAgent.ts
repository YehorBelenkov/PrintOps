import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

export const WSL_DISTRO = process.env.PRINTOPS_WSL_DISTRO ?? 'Ubuntu-24.04';
export const SANDBOX = process.env.PRINTOPS_SANDBOX ?? 'igor';

/** Set when the sandbox lives on another machine, as it does behind a serverless deploy. */
export const AGENT_API_URL = process.env.AGENT_API_URL?.replace(/\/$/, '') ?? '';
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? '';

export const isRemoteAgent = () => Boolean(AGENT_API_URL);

/** Calls the agent service and converts its failures into AgentError. */
export async function agentFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!AGENT_API_URL) throw new AgentError('No agent service is configured.');

  let response: Response;
  try {
    response = await fetch(`${AGENT_API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AGENT_TOKEN}`,
        ...init.headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AgentError(
      /timeout|abort/i.test(message)
        ? 'Igor ran out of time on that one. Try asking for one change at a time.'
        : 'Could not reach the agent service.',
      message.slice(0, 300)
    );
  }

  if (response.status === 401) {
    throw new AgentError('The agent service rejected our token.');
  }
  if (!response.ok) {
    throw new AgentError('The agent service returned an error.', `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

/** On Windows the sandbox lives behind WSL; on a Linux host bash is right there. */
const USE_WSL = process.env.PRINTOPS_USE_WSL
  ? process.env.PRINTOPS_USE_WSL === 'true'
  : process.platform === 'win32';

function shellCommand(script: string): [string, string[]] {
  return USE_WSL
    ? ['wsl', ['-d', WSL_DISTRO, '--', 'bash', '-lc', script]]
    : ['bash', ['-lc', script]];
}

export class AgentError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = 'AgentError';
  }
}

/** Runs an arbitrary command inside the sandbox and returns its combined output. */
export async function runInSandbox(
  innerScript: string,
  timeoutSeconds: number
): Promise<string> {
  const script =
    `timeout ${timeoutSeconds} nemoclaw ${SANDBOX} exec -- bash -lc '${innerScript}' 2>&1`;

  const [file, args] = shellCommand(script);

  try {
    const { stdout } = await execFileAsync(file, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: (timeoutSeconds + 10) * 1000,
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    const err = error as Omit<NodeJS.ErrnoException, 'code'> & {
      killed?: boolean;
      signal?: string;
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };

    // The base64 prompt dominates the message, so keep the tail where the cause is.
    const raw = `${err.stderr ?? ''}\n${err.message ?? String(error)}`;
    const detail = `exit=${err.code} signal=${err.signal} killed=${err.killed} :: ${raw
      .replace(/[A-Za-z0-9+/=]{200,}/g, '<prompt>')
      .slice(-300)}`;

    // Node kills with SIGTERM; the in-sandbox `timeout` command exits 124 instead.
    const timedOut =
      err.killed === true ||
      err.signal === 'SIGTERM' ||
      err.code === 124 ||
      /timed out|ETIMEDOUT/i.test(raw);

    if (timedOut) {
      throw new AgentError(
        'Igor ran out of time on that one. Try asking for one change at a time.',
        detail
      );
    }

    // A non-zero exit still carries the CLI's own explanation, which the caller
    // needs in order to tell a retryable provider blip from a real failure.
    const stdout = typeof err.stdout === 'string' ? err.stdout : '';
    if (stdout.trim()) return stdout;

    throw new AgentError('Could not reach Igor. Check that the sandbox is running.', detail);
  }
}

/** Upstream inference hiccups surface in stdout rather than a non-zero exit. */
const TRANSIENT =
  /temporarily overloaded|FailoverError|rate.?limit|try again in a moment|no text output returned for provider|\b(404|429|500|502|503|504)\b status code|upstream (error|timeout)/i;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * NVIDIA's endpoint has been measured refusing ~50% of calls with "temporarily
 * overloaded", and a refusal costs about as long as a success. Retrying is the only
 * lever available: the catalogue holds one model, so there is nothing to fail over to.
 * Six attempts at a 50% refusal rate leaves roughly a 1.6% chance of failing overall.
 */
const MAX_ATTEMPTS = Number(process.env.PRINTOPS_MAX_ATTEMPTS ?? 6);

/** Kept under the route's maxDuration so we surface an error rather than being killed. */
const RETRY_BUDGET_MS = Number(process.env.PRINTOPS_RETRY_BUDGET_MS ?? 150_000);

/** Measured: a refused call takes ~14s, a successful one ~15-20s. */
const ESTIMATED_ATTEMPT_MS = 20_000;

/**
 * Sends a prompt for a single stateless model turn, retrying provider hiccups.
 *
 * With AGENT_API_URL set the work happens on the agent service over HTTPS, which is
 * how a serverless deployment reaches the sandbox. Otherwise it runs locally.
 *
 * `capability model run` rather than `agent`: the agent keeps a session, so its
 * context grows with every message until requests time out.
 */
export async function runAgent(
  prompt: string,
  timeoutSeconds = 180,
  attempts = MAX_ATTEMPTS
): Promise<string> {
  const runOnce = AGENT_API_URL
    ? () => remoteAttempt(prompt, timeoutSeconds)
    : () => localAttempt(prompt, timeoutSeconds);

  const deadline = Date.now() + RETRY_BUDGET_MS;

  for (let attempt = 0; ; attempt++) {
    const out = await runOnce();
    if (!TRANSIENT.test(out)) return out;

    // Jitter keeps concurrent users from retrying in lockstep against a busy provider.
    const backoff = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
    const outOfTime = Date.now() + backoff + ESTIMATED_ATTEMPT_MS > deadline;

    if (attempt + 1 >= attempts || outOfTime) {
      throw new AgentError(
        'The model provider is overloaded right now. Please try again in a moment.',
        `attempts=${attempt + 1} :: ${out.slice(-300)}`
      );
    }
    await delay(backoff);
  }
}

/**
 * Both the prompt and the command consuming it are staged inside the sandbox as
 * base64: no quote or newline survives the Windows -> WSL -> bash -> sandbox chain,
 * because Node escapes double quotes for the Windows command line and the sandbox
 * re-parses argv through a shell.
 */
async function localAttempt(prompt: string, timeoutSeconds: number): Promise<string> {
  const id = randomUUID();
  const promptPath = `/tmp/printops-${id}.txt`;
  const scriptPath = `/tmp/printops-${id}.sh`;

  const script = `openclaw capability model run --thinking off --prompt "$(cat ${promptPath})"`;

  const inner =
    `echo ${Buffer.from(prompt, 'utf8').toString('base64')} | base64 -d > ${promptPath}; ` +
    `echo ${Buffer.from(script, 'utf8').toString('base64')} | base64 -d > ${scriptPath}; ` +
    `bash ${scriptPath}; rm -f ${promptPath} ${scriptPath}`;

  return runInSandbox(inner, timeoutSeconds);
}

async function remoteAttempt(prompt: string, timeoutSeconds: number): Promise<string> {
  const result = await agentFetch<{ output: string }>('/v1/agent', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout((timeoutSeconds + 20) * 1000),
  });
  return result.output ?? '';
}
