import winston from 'winston';
import config from '../config/config';

const colors = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[35m',
  reset: '\x1b[0m',
};

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp }) => {
      const color = colors[level as keyof typeof colors] || colors.info;
      return `${color}[${timestamp}] ${level.toUpperCase()}${colors.reset} ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

export default logger;