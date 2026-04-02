# Widget Integrations & Architecture Plan

## 1. HomeKit Integration & Fix
**Issue:** The HomeKit widget currently returns a `<PlaceholderWidget>` in `WidgetFactory.tsx`.
**Solution:**
- Create `HomeKitWidget.tsx`.
- Connect to your existing Homebridge (192.168.4.32:8581) and Home Assistant (192.168.4.32:8123) setups.
- Use the Homebridge API / Home Assistant REST/WebSocket API to fetch device statuses (Dyson, Molekule, Samsung TVs, Leafypod, Litter-Robot).
- Build a beautiful, responsive UI showing device cards with toggleable states.

## 2. Philips Hue Integration
**Implementation:**
- Create `HueWidget.tsx`.
- Use the local Philips Hue Bridge API (REST).
- **Features:** Display current lights/rooms, their on/off status, brightness, and colors. Include color pickers and sliders to edit/change lights directly from the widget.
- Needs the Hue Bridge IP and an application key (we will add configuration fields for this in the `WidgetConfigPanel.tsx`).

## 3. Nest Thermostat Integration
**Implementation:**
- Create `NestThermostatWidget.tsx`.
- Utilize the Google Smart Device Management (SDM) REST API.
- **Features:** Display current ambient temperature, humidity, HVAC status (heating, cooling, off). Allow target temperature adjustments.
- Note: Requires Google Cloud Project OAuth credentials and Device Access Console registration.

## 4. iCloud Shared Album Widget
**Implementation:**
- Create `iCloudAlbumWidget.tsx`.
- Utilize the iCloud Shared Album public URL API (undocumented but accessible).
  - Extract the token from the public link.
  - Call `https://p23-sharedstreams.icloud.com/.../webstream` to get the list of photos.
  - Call `/webasseturls` to get high-res image download links.
- **Features:** 
  - Settings for single/multiple photo views.
  - Customizable cycle speed (e.g., 10s, 30s, 1m).
  - Customizable transition effects (fade, slide, crossfade).
- *Technical detail:* Image URLs expire, so the widget will periodically refresh the asset URLs in the background.

## 5. Global Feeds Widget
**Implementation:**
- Create `FeedsWidget.tsx`.
- **US-CERT (CISA):** CISA discontinued RSS. We will use the CISA KEV JSON feed or the MS-ISAC RSS feed for cybersecurity alerts.
- **WHO / UN:** Parse their official RSS feeds for press releases and global alerts.
- **Politico:** Parse their RSS feed for the latest political news.
- **Features:** A unified, auto-scrolling ticker or a sleek card-based list view highlighting urgent alerts.

## 6. X (Twitter) Trending Widget
**Implementation:**
- Create `TwitterTrendingWidget.tsx`.
- Use the X API (utilizing the keys listed in your `API Keys Index.md`).
- **Features:** Display the top 5-10 trending topics for your region with an auto-refreshing UI.

## Execution Strategy
Once you approve this plan, I will:
1. Exit Plan Mode.
2. Spin up specialized sub-agents (`generalist`) to build out the data fetching hooks and API routes in Next.js.
3. Build the beautiful, platform-native looking UI components for each widget in `src/components/widgets/`.
4. Register them all in `WidgetFactory.tsx` and `types/widget.ts`.