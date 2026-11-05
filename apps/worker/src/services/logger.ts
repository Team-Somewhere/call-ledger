export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(
      `[${new Date().toISOString()}] [INFO] [WORKER] ${message}`,
      meta ? JSON.stringify(meta) : "",
    );
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(
      `[${new Date().toISOString()}] [WARN] [WORKER] \x1b[33m${message}\x1b[0m`,
      meta ? JSON.stringify(meta) : "",
    );
  },
  error(message: string, error?: unknown) {
    console.error(
      `[${new Date().toISOString()}] [ERROR] [WORKER] \x1b[31m${message}\x1b[0m`,
      error instanceof Error ? error.stack : error,
    );
  },
};
