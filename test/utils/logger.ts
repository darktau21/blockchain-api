function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function log(title: string, data?: unknown): void {
  if (data === undefined) {
    console.info(`[E2E] ${title}`);
  } else {
    console.info(`[E2E] ${title}:\n${safeStringify(data)}`);
  }
}

export function warn(title: string, data?: unknown): void {
  if (data === undefined) {
    console.warn(`[E2E] ${title}`);
  } else {
    console.warn(`[E2E] ${title}:\n${safeStringify(data)}`);
  }
}

export function error(title: string, data?: unknown): void {
  if (data === undefined) {
    console.error(`[E2E] ${title}`);
  } else {
    console.error(`[E2E] ${title}:\n${safeStringify(data)}`);
  }
}
