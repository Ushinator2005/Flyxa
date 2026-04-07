import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index';
export declare function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map