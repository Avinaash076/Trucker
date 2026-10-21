# TODO — Weather-Aware Truck Routing

## Trip input and validation

- [x] The user can enter origin, destination, departure date/time, and load weight.
- [x] The interface validates that both locations are present, the load weight is non-negative, and the departure time is a valid date/time before requesting analysis.
- [x] The interface supports 10, 25, and 50-mile checkpoint intervals.

## Routes, weather, and risk

- [x] The app generates 3 route options using routing/geocoding adapters with deterministic fallback data when optional providers are unavailable.
- [x] Weather is sampled at the selected 10 / 25 / 50-mile checkpoint interval using the truck's estimated arrival time at each checkpoint.
- [x] Wind, rain, and snow are classified with the provided Low, Moderate, High, Severe, and No Travel thresholds.
- [x] Load rules are exact: ≥55 mph is No Travel for any load; 45–54 mph with >30,000 lb is No Travel; 35–44 mph with >40,000 lb is Severe.
- [x] The app calculates route-level severe miles, high miles, average risk, travel time, and No Travel warnings.
- [x] Route recommendation priority is fewest Severe miles, fewest High miles, lowest average risk, then shortest travel time.

## Map and heatmap experience

- [x] The map shows all routes, route summaries, checkpoint locations, checkpoint ETAs, weather details, and risk levels.
- [x] The recommended route is clearly highlighted while alternative routes remain inspectable.
- [x] The trip corridor includes a weather heatmap with a smooth 0–48 hour forecast slider and a legend.
- [x] Selecting a route updates the checkpoint details and map emphasis without losing the recommendation context.

## Delivery and documentation

- [x] React frontend and Django backend source code are included.
- [x] Local setup, optional third-party API configuration, risk-model behavior, test commands, and deployment steps are documented.
- [x] The project contains a production Dockerfile and hosting configuration for a public server deployment.
- [x] The project is checked for TypeScript/Python syntax issues and the production frontend build succeeds.
