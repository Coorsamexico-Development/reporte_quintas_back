import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { jwtConstants } from './constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                (req) => {
                    if (req && req.query && typeof req.query.token === 'string') {
                        return req.query.token;
                    }
                    return null;
                }
            ]),
            ignoreExpiration: false,
            secretOrKey: jwtConstants.secret,
        });
    }

    async validate(payload: any) {
        return { 
            userId: payload.sub, 
            email: payload.email, 
            role: payload.role,
            permissions: payload.permissions,
            allowedCedis: payload.allowedCedis || null
        };
    }
}
