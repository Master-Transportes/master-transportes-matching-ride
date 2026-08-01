import type { IMatchingService } from "../contracts/IMatchingService.js";
import type { IOfferService } from "../contracts/IOfferService.js";

export interface ConsumerDeps {
  matchingService: IMatchingService;
  offerService: IOfferService;
}
