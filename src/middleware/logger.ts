import morgan, { StreamOptions } from 'morgan';

const stream: StreamOptions = {
  write: (message) => console.log(message.trimEnd()),
};

const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';

export const logger = morgan(format, {
  stream,
  skip: () => process.env.NODE_ENV === 'test',
});