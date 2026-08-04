import * as winston from "winston";

export const Log = winston.createLogger();
const { combine, colorize, timestamp, splat, printf } = winston.format;
const colorizer = colorize({ colors: { info: 'cyan' } });

Log.add(new winston.transports.Console({
    level: "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        splat(),
        printf(({ timestamp, level, message, ...args }) =>
            colorizer.colorize(level, `[${timestamp}] ${level.toUpperCase()}: ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ""}`)
        )
    )
}));
