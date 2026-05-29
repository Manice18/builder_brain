import fs from "fs";
import path from "path";

import { createLogger, transports, format } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

import { config } from "./env";

let dir = config.LOG_DIRECTORY;
if (!dir) dir = path.resolve("logs");

// create directory if it is not present
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const isDev = config.ENVIRONMENT === "development";
const logLevel = config.LOG_LEVEL;

const baseFormat = format.combine(format.errors({ stack: true }), format.timestamp());
const jsonFormat = format.combine(baseFormat, format.json());
const consoleFormat = isDev
  ? format.combine(
      baseFormat,
      format.colorize({ all: true }),
      format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const extra = Object.keys(meta).length
          ? ` ${JSON.stringify(meta, null, 2)}`
          : "";
        return stack
          ? `${timestamp} ${level}: ${message}\n${stack}${extra}`
          : `${timestamp} ${level}: ${message}${extra}`;
      }),
    )
  : jsonFormat;

if (isDev) {
  const todaysLogFile = path.join(
    dir,
    `${new Date().toISOString().slice(0, 10)}.log`,
  );
  if (fs.existsSync(todaysLogFile)) {
    fs.unlinkSync(todaysLogFile);
  }
}

const dailyRotateFile = new DailyRotateFile({
  level: logLevel,
  filename: path.join(dir, "%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  handleExceptions: true,
  maxSize: "20m",
  maxFiles: "14d",
  format: jsonFormat,
});

export default createLogger({
  level: logLevel,
  defaultMeta: { service: "builder_brain_be", env: config.ENVIRONMENT },
  transports: [
    new transports.Console({
      level: logLevel,
      format: consoleFormat,
      handleExceptions: true,
    }),
    dailyRotateFile,
  ],
  exceptionHandlers: [dailyRotateFile],
  rejectionHandlers: [dailyRotateFile],
  exitOnError: false, // do not exit on handled exceptions
});
