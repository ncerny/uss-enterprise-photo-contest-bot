import fs from 'node:fs';
import path from 'node:path';
import { createLogger, format, transports } from 'winston';
import TransportStream from 'winston-transport';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from './config/env';

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return stack ? `${ts} [${level}] ${stack}` : `${ts} [${level}] ${message}`;
});

const logDir = path.resolve(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const transportList: TransportStream[] = [
  new transports.Console({
    format: combine(colorize(), errors({ stack: true }), timestamp(), logFormat),
  }),
];

const enableFileLogs = (process.env.LOG_TO_FILES ?? 'true').toLowerCase() !== 'false';

if (enableFileLogs) {
  transportList.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'bot-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles: '14d',
      format: combine(errors({ stack: true }), timestamp(), logFormat),
    })
  );
}

export const logger = createLogger({
  level: env.LOG_LEVEL,
  format: combine(errors({ stack: true }), timestamp(), logFormat),
  transports: transportList,
});
