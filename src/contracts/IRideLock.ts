export interface LockHandle {
  token: string;
  rideId: string;
  renewalTimer?: ReturnType<typeof setInterval>;
}

export interface IRideLock {
  acquire(rideId: string): Promise<LockHandle | null>;
  release(handle: LockHandle | null): Promise<void>;
}
