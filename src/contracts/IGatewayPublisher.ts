export interface IGatewayPublisher {
  publishToUser(userId: string, event: string, payload: Record<string, unknown>): Promise<void>;
}
