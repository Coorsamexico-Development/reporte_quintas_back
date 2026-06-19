import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requiredPermission) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        if (!user) {
            return false;
        }

        // Admin has all permissions
        if (user.role === 'ADMIN') {
            return true;
        }

        if (!user.permissions) {
            return false;
        }

        // Expected format: "section:action" (e.g. "vehicles:create")
        const [section, action] = requiredPermission.split(':');
        if (!section || !action) {
            return false;
        }

        const sectionPerms = user.permissions[section];
        if (!sectionPerms) {
            if (section === 'vehicles' && action === 'read' && user.permissions['customerPanel']?.read) {
                return true;
            }
            return false;
        }

        return !!sectionPerms[action] || (section === 'vehicles' && action === 'read' && !!user.permissions['customerPanel']?.read);
    }
}
