import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// ─── Dev format — human-readable coloured lines ───────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),          // prints stack traces on Error objects
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] [${level}]: ${stack ?? message}${extras}`;
  }),
);

// ─── Prod format — structured JSON lines (grep/Datadog/CloudWatch friendly) ──
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  format: isProd ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
  ],
});

// ─── Optionally write errors to a file in production ─────────
if (isProd) {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level:    'error',
    format:   combine(timestamp(), errors({ stack: true }), json()),
  }));
}

export default logger;