import { EventEmitter } from 'node:events';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

export interface RealtimeEvent {
  type:
    | 'EVENT_STATUS_CHANGED'
    | 'ROOM_STATUS_CHANGED'
    | 'INVESTMENT_MADE'
    | 'IDEA_INVESTED'
    | 'WALLET_UPDATED'
    | 'SUBMISSION_UPDATED'
    | 'ARENA_CLOSED'
    | 'ADMIN_RESULTS_REVEALED'
    | 'RESULTS_REVEALED'
    | 'ADMIN_METRICS_UPDATED'
    | 'NOTIFICATION_RECEIVED'
    | 'NOTIFICATION_READ'
    | 'IDEA_ISSUE_REPORTED'
    | 'EVENT_SETTINGS_UPDATED'
    | 'EVENT_CONFIG_UPDATED'
    | 'DEFAULT_SETTINGS_UPDATED'
    | 'NEW_ARENA_INITIALIZED'
    | 'ROOM_UPDATED'
    | 'ROOM_CREATED'
    | 'ROOM_DELETED'
    | 'ROOM_STARTED'
    | 'TEAM_ASSIGNED'
    | 'TEAM_UNASSIGNED'
    | 'TEAM_MOVED'
    | 'HEARTBEAT';
  payload: any;
  recipientUserId?: string; // Optional: target specific user
  recipientRole?: string;   // Optional: target specific role
  recipientTeamId?: string; // Optional: target specific team
  recipientRoomId?: string; // Optional: target specific room
  timestamp: number;
  originInstanceId?: string;
}

const REDIS_CHANNEL = 'csea:realtime:events';

class RealtimeHub extends EventEmitter {
  private static instance: RealtimeHub;
  private instanceId: string;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private isRedisConnected = false;

  private constructor() {
    super();
    this.setMaxListeners(500); // Support high concurrent SSE connections
    this.instanceId = randomUUID();
    this.initRedis();
  }

  private initRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return;
    }

    try {
      this.pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 1000, 10000),
      });

      this.subClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 1000, 10000),
      });

      this.pubClient.on('connect', () => {
        this.isRedisConnected = true;
      });

      this.pubClient.on('error', (err) => {
        this.isRedisConnected = false;
        console.warn('[RealtimeHub] Redis pub error, falling back to local bus:', err.message);
      });

      this.subClient.on('connect', () => {
        this.subClient?.subscribe(REDIS_CHANNEL, (err) => {
          if (err) {
            console.error('[RealtimeHub] Failed to subscribe to Redis channel:', err);
          }
        });
      });

      this.subClient.on('message', (channel, message) => {
        if (channel !== REDIS_CHANNEL) return;
        try {
          const event: RealtimeEvent = JSON.parse(message);
          // If event was published by this instance, skip (already emitted locally)
          if (event.originInstanceId === this.instanceId) {
            return;
          }
          super.emit('realtime_event', event);
        } catch (err) {
          console.error('[RealtimeHub] Error parsing Redis message:', err);
        }
      });

      this.subClient.on('error', (err) => {
        console.warn('[RealtimeHub] Redis sub error, falling back to local bus:', err.message);
      });

      // Connect asynchronously
      this.pubClient.connect().catch((err) => {
        console.warn('[RealtimeHub] Could not connect pubClient to Redis:', err.message);
      });
      this.subClient.connect().catch((err) => {
        console.warn('[RealtimeHub] Could not connect subClient to Redis:', err.message);
      });
    } catch (err) {
      console.warn('[RealtimeHub] Could not initialize Redis pub/sub:', err);
    }
  }

  public static getInstance(): RealtimeHub {
    if (!RealtimeHub.instance) {
      RealtimeHub.instance = new RealtimeHub();
    }
    return RealtimeHub.instance;
  }

  private dispatch(event: RealtimeEvent) {
    event.originInstanceId = this.instanceId;
    this.emit('realtime_event', event);

    if (this.pubClient && this.isRedisConnected) {
      this.pubClient.publish(REDIS_CHANNEL, JSON.stringify(event)).catch((err) => {
        console.warn('[RealtimeHub] Redis publish failed:', err.message);
      });
    }
  }

  public getRedisStatus(): 'connected' | 'disconnected' | 'disabled' {
    if (!process.env.REDIS_URL) return 'disabled';
    return this.isRedisConnected ? 'connected' : 'disconnected';
  }

  public broadcast(type: RealtimeEvent['type'], payload: any) {
    this.dispatch({
      type,
      payload,
      timestamp: Date.now(),
    });
  }

  public broadcastToUser(userId: string, type: RealtimeEvent['type'], payload: any) {
    this.dispatch({
      type,
      payload,
      recipientUserId: userId,
      timestamp: Date.now(),
    });
  }

  public broadcastToRole(role: string, type: RealtimeEvent['type'], payload: any) {
    this.dispatch({
      type,
      payload,
      recipientRole: role,
      timestamp: Date.now(),
    });
  }

  public broadcastToTeam(teamId: string, type: RealtimeEvent['type'], payload: any) {
    this.dispatch({
      type,
      payload,
      recipientTeamId: teamId,
      timestamp: Date.now(),
    });
  }

  public broadcastToRoom(roomId: string, type: RealtimeEvent['type'], payload: any) {
    this.dispatch({
      type,
      payload,
      recipientRoomId: roomId,
      timestamp: Date.now(),
    });
  }
}

export const realtimeHub = RealtimeHub.getInstance();