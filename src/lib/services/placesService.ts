/**
 * Places facade. Re-exports `places.ts` so pages/components depend on `services/placesService`.
 */
export type { ActivityCategory, PlaceDetails, PlaceProsCons, PlaceResult, PlaceReview } from '../places';
export {
    fetchNearbyPlaces,
    fetchNearbyRestaurants,
    fetchPlaceDetails,
    generateProsCons,
    getNearbyPlacesLabel,
    resolvePlaceId,
} from '../places';
