import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { DriverLocationService } from './driver-location.service';
import { SupabaseAuthService } from '../../auth/supabase-auth.service';

interface LocationBroadcast {
  driverId: string;
  userId: string;
  fullName: string;
  vehicleType: string;
  vehiclePlate: string;
  currentLat: number;
  currentLng: number;
  lastLocationAt: string;
  status: string;
}

@WebSocketGateway({
  namespace: '/driver-locations',
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://unitedpharmacy.net',
      'https://www.unitedpharmacy.net',
      'https://unitedpharmacy.io',
      'https://www.unitedpharmacy.io',
    ],
    credentials: true,
  },
})
@Injectable()
export class LocationBroadcastGateway 
  implements OnGatewayConnection, OnGatewayDisconnect 
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationBroadcastGateway.name);
  private connectedClients = new Map<string, Socket>();
  private driverSockets = new Map<string, string>(); // driverId -> socketId

  constructor(
    @Inject(forwardRef(() => DriverLocationService))
    private readonly locationService: DriverLocationService,
    private readonly authService: SupabaseAuthService,
  ) {}

  /**
   * Handle client connection
   */
  async handleConnection(client: Socket) {
    const token = this.readSocketToken(client);
    if (!token) {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const authenticated = await this.authService.authenticateAccessToken(token);
      if (!['admin', 'manager'].includes(authenticated.profile.role)) {
        this.logger.warn(`Rejected non-admin socket ${client.id}`);
        client.disconnect(true);
        return;
      }
      client.data.user = authenticated;
    } catch {
      this.logger.warn(`Rejected invalid-token socket ${client.id}`);
      client.disconnect(true);
      return;
    }

    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Send initial data of all online drivers
    try {
      const onlineDrivers = await this.locationService.getAllOnlineDriversLocations();
      client.emit('initial-drivers', onlineDrivers);
    } catch (error) {
      this.logger.error('Error sending initial drivers data', error);
    }
  }

  private readSocketToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();

    const header = client.handshake.headers.authorization;
    const match = typeof header === 'string' ? header.match(/^Bearer\s+(.+)$/i) : null;
    return match?.[1]?.trim() || null;
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
    
    // Remove driver socket mapping if this was a driver
    for (const [driverId, socketId] of this.driverSockets.entries()) {
      if (socketId === client.id) {
        this.driverSockets.delete(driverId);
        break;
      }
    }
  }

  /**
   * Handle driver location updates
   * Called from DriverLocationService after successful location update
   */
  broadcastLocationUpdate(locationData: LocationBroadcast) {
    this.server.emit('driver-location-update', locationData);
    this.logger.debug(`Broadcasted location update for driver ${locationData.driverId}`);
  }

  /**
   * Handle driver online status changes
   */
  broadcastDriverStatusChange(data: {
    driverId: string;
    userId: string;
    fullName: string;
    vehicleType: string;
    vehiclePlate: string;
    isOnline: boolean;
    status: string;
  }) {
    this.server.emit('driver-status-change', data);
    this.logger.debug(`Broadcasted status change for driver ${data.driverId}: ${data.isOnline ? 'online' : 'offline'}`);
  }

  /**
   * Subscribe to driver location updates (for driver clients)
   */
  @SubscribeMessage('subscribe-driver-updates')
  handleDriverSubscription(
    @MessageBody() data: { driverId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data.driverId) {
      this.driverSockets.set(data.driverId, client.id);
      client.join(`driver-${data.driverId}`);
      this.logger.log(`Driver ${data.driverId} subscribed to location updates`);
    }
  }

  /**
   * Subscribe to admin updates (for admin dashboard)
   */
  @SubscribeMessage('subscribe-admin-updates')
  handleAdminSubscription(@ConnectedSocket() client: Socket) {
    client.join('admin-updates');
    this.logger.log(`Admin client ${client.id} subscribed to updates`);
  }

  /**
   * Unsubscribe from updates
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    // Leave all rooms
    client.rooms.forEach(room => {
      if (room !== client.id) {
        client.leave(room);
      }
    });
    this.logger.log(`Client ${client.id} unsubscribed from all updates`);
  }

  /**
   * Send location update to specific driver
   */
  sendToDriver(driverId: string, event: string, data: any) {
    this.server.to(`driver-${driverId}`).emit(event, data);
  }

  /**
   * Send update to admin clients
   */
  sendToAdmins(event: string, data: any) {
    this.server.to('admin-updates').emit(event, data);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalConnections: this.connectedClients.size,
      driverConnections: this.driverSockets.size,
      adminConnections: this.server.sockets.adapter.rooms.get('admin-updates')?.size || 0,
    };
  }
}