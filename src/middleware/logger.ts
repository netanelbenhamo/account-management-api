import morgan, { StreamOptions } from 'morgan';
import { REQUEST_ID_HEADER } from './requestId';

const stream: StreamOptions = {
  write: (message) => console.log(message.trimEnd()),
};

morgan.token('request-id', (req) => {
  return req.headers[REQUEST_ID_HEADER.toLowerCase()] as string ?? '-';
});

const devFormat = ':request-id :method :url :status :response-time ms';

const prodFormat = ':request-id :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

const format = process.env.NODE_ENV === 'production' ? prodFormat : devFormat;

export const logger = morgan(format, {
  stream,
  skip: () => process.env.NODE_ENV === 'test',
});