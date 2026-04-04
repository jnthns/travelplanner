---
schema_version: 1
repo_purpose: travelplanner_firebase_react_cf_worker
primary_stack: react19_typescript_vite_firebase_firestore_cloudflare_worker_gemini_places_openmeteo
llm_instructions: |
  Use this file to resolve entity→collection→code paths. Dates YYYY-MM-DD.
  Firestore writes must strip undefined (see store.ts stripUndefined).
  AI calls only via generateWithGemini from src/lib/gemini.ts (proxy).
  Places only via worker proxy (src/lib/places.ts).
entities:
  - name: Trip
    typescript_type: Trip
    type_file: src/lib/types.ts
    firestore_collection: trips
    access_rules_file: firestore.rules
    access_pattern: read members array-contains uid OR userId==uid; update/delete owner
    crud_hooks: useTrips
    hook_file: src/lib/store.ts
    notable_fields: [id, userId, members, sharedWithEmails, name, startDate, endDate, defaultCurrency, color, itinerary, dayLocations, budgetTarget]
    child_denormalization: tripMembers on activities transportRoutes notes chat_history

  - name: Activity
    typescript_type: Activity
    type_file: src/lib/types.ts
    firestore_collection: activities
    access_rules_file: firestore.rules
    access_pattern: tripMembers contains uid OR owner rule
    crud_hooks: useActivities
    hook_file: src/lib/store.ts
    invariant_date_iso: "YYYY-MM-DD"
    invariant_tripMembers: denormalized from trip.members

  - name: TransportRoute
    typescript_type: TransportRoute
    type_file: src/lib/types.ts
    firestore_collection: transportRoutes
    access_rules_file: firestore.rules
    crud_hooks: useTransportRoutes
    hook_file: src/lib/store.ts

  - name: Note
    typescript_type: Note
    type_file: src/lib/types.ts
    firestore_collection: notes
    access_rules_file: firestore.rules
    crud_hooks: useNotes
    hook_file: src/lib/store.ts
    storage_path_pattern: notes/{userId}/{tripId}/ per storage.rules

  - name: ChatMessage
    typescript_type: ChatMessage
    type_file: src/lib/types.ts
    firestore_collection: chat_history
    access_rules_file: firestore.rules
    crud_hooks: useChatHistory
    hook_file: src/lib/store.ts
    role_enum: [user, model]

  - name: UserProfile
    typescript_type: UserProfile
    type_file: src/lib/types.ts
    firestore_collection: users
    access_rules_file: firestore.rules

  - name: TripScenario
    typescript_type: TripScenario
    type_file: src/lib/types.ts
    persistence: localStorage_scenarios_src/lib/scenarios.ts
    note: draft snapshots not Firestore in typical flow

integrations:
  ai_generation:
    client_file: src/lib/gemini.ts
    worker_route: POST /generate
    env_frontend: VITE_AI_PROXY_URL
  google_places:
    client_file: src/lib/places.ts
    worker_routes: [POST /places/nearby, POST /places/details]
  weather:
    client_file: src/lib/weather.ts
    external: Open-Meteo

routing:
  basename: /travelplanner/
  app_shell: src/App.tsx

large_ui_pages:
  - src/pages/CalendarView.tsx
  - src/pages/useCalendarViewController.ts
  - src/pages/ImportItinerary.tsx

refactor_notes:
  calendar_controller: src/pages/useCalendarViewController.ts
  import_itinerary_controller: pending_extract_high_risk
