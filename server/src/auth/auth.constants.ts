import * as jwt from 'jsonwebtoken';

export const jwtConstants: {
  secret: string;
  options: jwt.SignOptions;
} = {
  secret: 'secretKey',
  options: {
    expiresIn: '1h',
    algorithm: 'HS256',
  },
};
