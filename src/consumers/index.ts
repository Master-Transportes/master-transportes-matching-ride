import type { ConsumerDeps } from "./consumer-deps.js";
import { register as registerRideRequested } from "./rideRequested.consumer.js";
import { register as registerOfferAccepted } from "./rideOfferAccepted.consumer.js";
import { register as registerOfferRejected } from "./rideOfferRejected.consumer.js";
import { register as registerOfferExpired } from "./rideOfferExpired.consumer.js";
import { register as registerOfferTimeout } from "./rideOfferTimeout.consumer.js";
import { register as registerRideCancelled } from "./rideCancelled.consumer.js";

export async function registerAll(deps: ConsumerDeps): Promise<void> {
  await registerRideRequested(deps);
  await registerOfferAccepted(deps);
  await registerOfferRejected(deps);
  await registerOfferExpired(deps);
  await registerOfferTimeout(deps);
  await registerRideCancelled(deps);
}
