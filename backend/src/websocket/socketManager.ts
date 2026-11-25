import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { config } from '../config';
import { getDb } from '../config/database';
import { logger } from '../utils/logger';

let io: Server | null = null;
const connectedUsersByOrg = new Map<string, Set<string>>();

interface SocketAuthPayload {
  sub: string;
  email: string;
}

export function initializeSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as SocketAuthPayload;
      socket.data.userId = decoded.sub;
      socket.data.email = decoded.email;

      const orgId = socket.handshake.auth?.orgId as string | undefined;
      if (orgId) {
        const member = await getDb()('organization_members')
          .where({ org_id: orgId, user_id: decoded.sub })
          .first('id');
        if (!member) {
          return next(new Error('Forbidden organization socket channel'));
        }
        socket.data.orgId = orgId;
      }

      next();
    } catch {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    const orgId = socket.data.orgId as string | undefined;

    socket.join(`user:${userId}`);
    if (orgId) {
      socket.join(`org:${orgId}`);
      if (!connectedUsersByOrg.has(orgId)) {
        connectedUsersByOrg.set(orgId, new Set());
      }
      connectedUsersByOrg.get(orgId)!.add(userId);
    }

    socket.on('join:project', async (projectId: string) => {
      if (!orgId || typeof projectId !== 'string') return;
      const proj = await getDb()('projects')
        .where({ id: projectId, org_id: orgId })
        .first('id');
      if (proj) {
        socket.join(`project:${projectId}`);
      }
    });

    socket.on('leave:project', (projectId: string) => {
      if (typeof projectId === 'string') {
        socket.leave(`project:${projectId}`);
      }
    });

    socket.on('join:task', (taskId: string) => {
      if (typeof taskId === 'string') {
        socket.join(`task:${taskId}`);
      }
    });

    socket.on('disconnect', () => {
      if (orgId && connectedUsersByOrg.has(orgId)) {
        connectedUsersByOrg.get(orgId)!.delete(userId);
      }
    });
  });

  logger.info('Socket.IO real-time server initialized');
  return io;
}

export function getSocketIO(): Server | null {
  return io;
}

export function emitToOrg(orgId: string, event: string, payload: unknown): void {
  io?.to(`org:${orgId}`).emit(event, payload);
}

export function emitToProject(projectId: string, event: string, payload: unknown): void {
  io?.to(`project:${projectId}`).emit(event, payload);
}

export function emitToTask(taskId: string, event: string, payload: unknown): void {
  io?.to(`task:${taskId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function getConnectedUsersCount(orgId: string): number {
  return connectedUsersByOrg.get(orgId)?.size ?? 0;
}

export async function closeSocketIO(): Promise<void> {
  if (io) {
    await new Promise<void>((resolve) => io!.close(() => resolve()));
    io = null;
    connectedUsersByOrg.clear();
  }
}
