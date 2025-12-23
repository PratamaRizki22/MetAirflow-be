# Property Management Documentation

## 1. Adding a Property

To add a new property listing, you need to send a `POST` request to the `/api/v1/properties` endpoint.

**Endpoint:** `POST /api/v1/properties`
**Auth Required:** Yes (Bearer Token)
**Role Required:** USER or ADMIN

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | The title of the property listing found in the header |
| `address` | string | Yes | Full street address |
| `city` | string | Yes | City name |
| `state` | string | Yes | State/Province name |
| `zipCode` | string | Yes | Postal code |
| `price` | number | Yes | Monthly rent price |
| `propertyTypeId` | uuid | Yes | ID of the property type (e.g., Apartment, House) |
| `description` | string | No | Detailed description of the property |
| `country` | string | No | Country code (default: MY) |
| `bedrooms` | integer | No | Number of bedrooms |
| `bathrooms` | integer | No | Number of bathrooms |
| `areaSqm` | number | No | Area in square meters |
| `furnished` | boolean | No | Is the property furnished? |
| `isAvailable` | boolean | No | Is it available for rent? (default: true) |
| `amenityIds` | array[uuid] | No | List of amenity IDs to associate |
| `images` | array[string] | No | List of image URLs |
| `latitude` | number | No | Geographic latitude |
| `longitude` | number | No | Geographic longitude |

### Example Request

```json
{
  "title": "Luxury Apartment in KLCC",
  "description": "A beautiful 2-bedroom apartment with city view.",
  "address": "123 Jalan Ampang",
  "city": "Kuala Lumpur",
  "state": "Wilayah Persekutuan",
  "country": "MY",
  "zipCode": "50450",
  "price": 3500,
  "propertyTypeId": "uuid-of-property-type",
  "bedrooms": 2,
  "bathrooms": 2,
  "areaSqm": 85.5,
  "furnished": true,
  "amenityIds": ["uuid-amenity-1", "uuid-amenity-2"],
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ]
}
```

## 2. Property Approval Process

By default, newly created properties have the status `PENDING_REVIEW` (unless Auto-Approve is enabled by Admin).

-   **PENDING_REVIEW**: The property is created but not yet visible to public searches.
-   **APPROVED**: The property is approved by an Admin and is visible to everyone.
-   **REJECTED**: The property was rejected by an Admin (with notes explaining why).

## 3. Admin Responsibilities

The **ADMIN** role allows specific users to manage the platform's content and users. Key responsibilities include:

### Property Moderation
*   **Approve/Reject Listings:** Admins review properties in `PENDING_REVIEW` status and can approve or reject them.
*   **Auto-Approve Toggle:** Admins can enable/disable "Auto-Approve" mode. If enabled, new properties automatically become `APPROVED`.
*   **Manage Any Property:** Admins can edit or delete any property listing, regardless of ownership.

### Master Data Management
*   **Property Types:** Create, update, or delete property types (e.g., Apartment, Villa, Studio).
*   **Amenities:** Manage the list of available amenities (e.g., WiFi, Pool, Gym).

### User Management
*   Admins can view and manage all users in the system (functionality depends on specific user module implementation).
