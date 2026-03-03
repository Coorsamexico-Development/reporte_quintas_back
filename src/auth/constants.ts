const getSecret = () => {
    const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev_secret_key_yardtruck');
    
    if (process.env.NODE_ENV === 'production' && !secret) {
        throw new Error('JWT_SECRET must be defined in production environment');
    }
    
    return secret as string;
};

export const jwtConstants = {
    secret: getSecret(),
};

