import * as winston from "winston";

export const LOGGER = winston.createLogger();
const { combine, colorize, timestamp, splat, printf, align } = winston.format;
const colorizer = colorize({ colors: { info: 'green' } });

LOGGER.add(new winston.transports.Console({
    level: "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        align(),
        splat(),
        printf(({ timestamp, level, message, ...args }) =>
            colorizer.colorize(level, `[${timestamp}] ${level.toUpperCase()}: ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ""}`)
        ),
    ),
}));
