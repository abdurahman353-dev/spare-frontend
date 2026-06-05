"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSettings } from "@/components/providers/SettingsProvider";
import api, { getActiveDestinationsCached, getCountriesCached } from "@/lib/axios";

// Custom premium pulsing marker icon in Leaflet
const customMarkerIcon = L.divIcon({
  html: `
    <div class="relative flex items-center justify-center h-6 w-6">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60"></span>
      <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600 border border-white shadow-md"></span>
    </div>
  `,
  className: "custom-leaflet-icon",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});
L.Marker.prototype.options.icon = customMarkerIcon;

interface MapHub {
  name: string;
  coords: [number, number];
  desc: string;
}

export default function HubMapContent() {
  const { settings } = useSettings();
  const [hubs, setHubs] = useState<MapHub[]>([]);

  useEffect(() => {
    const fetchActiveZonesAndSyncMap = async () => {
      try {
        // Fetch active shipping zones directly for 100% real-time mapping!
        const [activeDestinations, realLocations] = await Promise.all([
          getActiveDestinationsCached(),
          getCountriesCached().catch(() => [])
        ]);

        // Parse custom coordinates/descriptions configured by the administrator in settings
        let configuredHubs: any[] = [];
        if (settings.map_hubs) {
          try {
            configuredHubs = JSON.parse(settings.map_hubs);
          } catch (e) {
            console.error("Failed to parse map hubs:", e);
          }
        }

        const getCoordinatesForLocation = (city: string, country: string) => {
          const cleanCity = city?.trim().toLowerCase() || "";
          const cleanCountry = country?.trim().toLowerCase() || "";

          const COORDS: Record<string, { lat: number; lng: number; desc: string }> = {
            // Kenya
            "nairobi": { lat: -1.2921, lng: 36.8219, desc: "Main Distribution Center & Headquarters" },
            "mombasa": { lat: -4.0435, lng: 39.6682, desc: "Coastal Distribution Hub" },
            "kisumu": { lat: -0.1022, lng: 34.7617, desc: "Western Lake Basin Hub" },
            "nakuru": { lat: -0.3031, lng: 36.0800, desc: "Rift Valley Distribution Node" },
            "eldoret": { lat: 0.5143, lng: 35.2698, desc: "North Rift Logistics Center" },
            "naivasha": { lat: -0.7171, lng: 36.4399, desc: "Rift Valley Logistics Point" },
            "nyeri": { lat: -0.4215, lng: 36.9515, desc: "Central Highlands Logistics Hub" },
            "thika": { lat: -1.0333, lng: 37.0692, desc: "Industrial Zone Distribution Point" },
            "machakos": { lat: -1.5177, lng: 37.2634, desc: "Eastern Region Hub" },
            "malindi": { lat: -3.2230, lng: 40.1169, desc: "Coastal Transit Point" },
            "kakamega": { lat: 0.2842, lng: 34.7523, desc: "Western Transit Center" },
            "kisii": { lat: -0.6817, lng: 34.7717, desc: "Nyanza Highlands Transit Point" },
            "kitale": { lat: 1.0152, lng: 35.0062, desc: "Trans-Nzoia Distribution Center" },
            "garissa": { lat: -0.4569, lng: 39.6401, desc: "North-Eastern Transit Point" },
            "lodwar": { lat: 3.1191, lng: 35.5973, desc: "Turkana Transit Hub" },
            "lamu": { lat: -2.2694, lng: 40.9022, desc: "Northern Coast Logistics Center" },
            "kericho": { lat: -0.3677, lng: 35.2825, desc: "South Rift Distribution Point" },
            "embu": { lat: -0.5311, lng: 37.4506, desc: "Eastern Highlands Transit Center" },
            // Uganda
            "kampala": { lat: 0.3476, lng: 32.5825, desc: "Uganda Central Distribution Hub" },
            "entebbe": { lat: 0.0512, lng: 32.4637, desc: "Entebbe International Logistics Node" },
            "jinja": { lat: 0.4244, lng: 33.2042, desc: "Eastern Uganda Industrial Hub" },
            "mbale": { lat: 1.0785, lng: 34.1758, desc: "Mount Elgon Logistics Point" },
            "mbarara": { lat: -0.6074, lng: 30.6545, desc: "Western Region Transit Hub" },
            "gulu": { lat: 2.7724, lng: 32.2990, desc: "Northern Uganda Logistics Center" },
            "lira": { lat: 2.2473, lng: 32.9000, desc: "Lango Sub-Region Transit Point" },
            "masaka": { lat: -0.3416, lng: 31.7371, desc: "South-Western Transit Node" },
            "arua": { lat: 3.0303, lng: 30.9111, desc: "West Nile Region Logistics Point" },
            "mukono": { lat: 0.3547, lng: 32.7522, desc: "Central Region Logistics Center" },
            "fort portal": { lat: 0.6931, lng: 30.2727, desc: "Tourism & Transit Hub" },
            "soroti": { lat: 1.7146, lng: 33.6111, desc: "Eastern Region Transit Node" },
            "kabale": { lat: -1.2486, lng: 29.9892, desc: "Kigezi Sub-Region Transit Point" },
            "hoima": { lat: 1.4331, lng: 31.3524, desc: "Albertine Region Transit Hub" },
            "tororo": { lat: 0.6925, lng: 34.1808, desc: "Eastern Border Transit Point" },
            // Tanzania
            "dar es salaam": { lat: -6.7924, lng: 39.2083, desc: "Coastal Entry & Distribution Center" },
            "dodoma": { lat: -6.1630, lng: 35.7516, desc: "Tanzania Capital Hub" },
            "arusha": { lat: -3.3731, lng: 36.6853, desc: "Northern Tanzania Logistics Center" },
            "mwanza": { lat: -2.5164, lng: 32.8987, desc: "Lake Victoria Region Hub" },
            "zanzibar city": { lat: -6.1634, lng: 39.1979, desc: "Zanzibar Archipelago Transit Point" },
            "tanga": { lat: -5.0689, lng: 39.0988, desc: "Coastal Port Logistics Point" },
            "mbeya": { lat: -8.9094, lng: 33.4608, desc: "Southern Highlands Transit Center" },
            "morogoro": { lat: -6.8219, lng: 37.6612, desc: "Eastern Transit Node" },
            "tabora": { lat: -5.0162, lng: 32.8267, desc: "Central Transit Hub" },
            "moshi": { lat: -3.3349, lng: 37.3402, desc: "Kilimanjaro Logistics Node" },
            "kigoma": { lat: -4.8769, lng: 29.6267, desc: "Lake Tanganyika Port Point" },
            "iringa": { lat: -7.7854, lng: 35.6862, desc: "Southern Highlands Logistics Node" },
            "songea": { lat: -10.6800, lng: 35.6500, desc: "Ruvuma Transit Hub" },
            "musoma": { lat: -1.5000, lng: 33.8000, desc: "Mara Region Logistics Point" },
            // Rwanda
            "kigali": { lat: -1.9403, lng: 30.0619, desc: "West-Regional Hub" },
            "gisenyi": { lat: -1.6992, lng: 29.2588, desc: "Lake Kivu Logistics Node" },
            "butare": { lat: -2.5967, lng: 29.7394, desc: "Southern Region Transit Center" },
            "musanze": { lat: -1.4998, lng: 29.6350, desc: "Northern Region Logistics Hub" },
            "gitarama": { lat: -2.0739, lng: 29.7567, desc: "Central Transit Hub" },
            "kibuye": { lat: -2.0603, lng: 29.3478, desc: "Western Region Logistics Point" },
            "cyangugu": { lat: -2.4846, lng: 28.8970, desc: "South-Western Border Node" },
            "rwamagana": { lat: -1.9487, lng: 30.4347, desc: "Eastern Region Transit Center" },
            "byumba": { lat: -1.5764, lng: 30.0675, desc: "Northern Province Transit Point" },
            "kibungo": { lat: -2.1597, lng: 30.5422, desc: "Eastern Province Logistics Node" },
            // Burundi
            "bujumbura": { lat: -3.3822, lng: 29.3644, desc: "Burundi Transit & Logistics Point" },
            "gitega": { lat: -3.4271, lng: 29.9246, desc: "Burundi Central Capital Hub" },
            "ngozi": { lat: -2.9075, lng: 29.8306, desc: "Northern Burundi Transit Node" },
            "rumonge": { lat: -3.9739, lng: 29.4386, desc: "Lake Tanganyika Southern Transit Point" },
            "kayanza": { lat: -2.9239, lng: 29.6267, desc: "North-Western Logistics Center" },
            "muyinga": { lat: -2.8489, lng: 30.3414, desc: "North-Eastern Transit Point" },
            "makamba": { lat: -4.1350, lng: 29.8000, desc: "Southern Burundi Transit Point" },
            "kirundo": { lat: -2.5833, lng: 30.1000, desc: "Lake Cohoha Logistics Node" },
            // South Sudan
            "juba": { lat: 4.8517, lng: 31.5822, desc: "South Sudan Distribution Center" },
            "malakal": { lat: 9.5333, lng: 31.6500, desc: "Upper Nile Region Transit Center" },
            "wau": { lat: 7.7000, lng: 27.9833, desc: "Western Bahr el Ghazal Logistics Hub" },
            "yei": { lat: 4.0950, lng: 30.6778, desc: "Southern Border Transit Point" },
            "yambio": { lat: 4.5667, lng: 28.3833, desc: "Western Equatoria Transit Center" },
            "bor": { lat: 6.2081, lng: 31.5594, desc: "Jonglei Region Logistics Point" },
            "bentiu": { lat: 9.2333, lng: 29.8333, desc: "Unity State Logistics Node" },
            "torit": { lat: 4.4133, lng: 32.5678, desc: "Eastern Equatoria Transit Point" },
            "rumbek": { lat: 6.8000, lng: 29.6833, desc: "Lakes State Logistics Hub" },
            // Somalia
            "mogadishu": { lat: 2.0439, lng: 45.3438, desc: "Somalia Port & Primary Logistics Center" },
            "hargeisa": { lat: 9.5624, lng: 44.0652, desc: "Somaliland Logistics Center" },
            "bosaso": { lat: 11.2842, lng: 49.1816, desc: "Northern Port Logistics Point" },
            "galkacyo": { lat: 6.7697, lng: 47.4308, desc: "Central Somalia Transit Node" },
            "kismayo": { lat: -0.3582, lng: 42.5454, desc: "Southern Port Logistics Center" },
            "merca": { lat: 1.7159, lng: 44.7707, desc: "Lower Shabelle Transit Point" },
            "baidoa": { lat: 3.1138, lng: 43.6498, desc: "Bay Region Logistics Node" },
            "burao": { lat: 9.5222, lng: 45.5333, desc: "Togdheer Region Transit Hub" },
            // DRC
            "kinshasa": { lat: -4.4419, lng: 15.2663, desc: "DRC Central Port Hub" },
            "lubumbashi": { lat: -11.6873, lng: 27.5026, desc: "Katanga Copperbelt Transit Hub" },
            "mbuji-mayi": { lat: -6.1360, lng: 23.5898, desc: "Kasai Region Distribution Point" },
            "kisangani": { lat: 0.5153, lng: 25.1909, desc: "Congo River Logistics Hub" },
            "goma": { lat: -1.6741, lng: 29.2285, desc: "East-Kivu Regional Hub" },
            "bukavu": { lat: -2.5074, lng: 28.8608, desc: "South-Kivu Transit Center" },
            "kananga": { lat: -5.8962, lng: 22.4166, desc: "Lulua Region Logistics Center" },
            "likasi": { lat: -10.9821, lng: 26.7329, desc: "Mining Region Logistics Point" },
            "kolwezi": { lat: -10.7186, lng: 25.4729, desc: "Lualaba Logistics Node" },
            "kikwit": { lat: -5.0410, lng: 18.8162, desc: "Kwilu Province Transit Hub" },
            // Ethiopia
            "addis ababa": { lat: 9.0300, lng: 38.7400, desc: "Ethiopian Central Logistics Hub" },
            "dire dawa": { lat: 9.6000, lng: 41.8667, desc: "Chartered City Transit Point" },
            "mek'ele": { lat: 13.4967, lng: 39.4678, desc: "Tigray Region Logistics Node" },
            "gondar": { lat: 12.6000, lng: 37.4667, desc: "Amhara Province Logistics Hub" },
            "adama": { lat: 8.5414, lng: 39.2689, desc: "Oromia Region Logistics Center" },
            "hawassa": { lat: 7.0500, lng: 38.4833, desc: "Sidama Region Logistics Node" },
            "bahir dar": { lat: 11.5900, lng: 37.3900, desc: "Lake Tana Transit Point" },
            "jimma": { lat: 7.6667, lng: 36.8333, desc: "Oromia Province Transit Point" },
            // Eritrea
            "asmara": { lat: 15.3381, lng: 38.9312, desc: "Eritrean Capital Distribution Hub" },
            "keren": { lat: 15.7778, lng: 38.4500, desc: "Anseba Region Logistics Point" },
            "massawa": { lat: 15.6097, lng: 39.4447, desc: "Red Sea Port Logistics Center" },
            "assab": { lat: 13.0100, lng: 42.7400, desc: "Southern Red Sea Port Node" },
            "mendefera": { lat: 14.8889, lng: 38.8167, desc: "Debub Region Transit Point" },
            // Djibouti
            "djibouti city": { lat: 11.5880, lng: 43.1450, desc: "Horn of Africa Free Trade Port Hub" },
            "ali sabieh": { lat: 11.1514, lng: 42.7125, desc: "Border Transit Logistics Hub" },
            "tadjoura": { lat: 11.7853, lng: 42.8831, desc: "Gulf of Tadjoura Port Point" },
            "obock": { lat: 11.9667, lng: 43.2833, desc: "Northern Port Logistics Node" },
            // Madagascar
            "antananarivo": { lat: -18.8792, lng: 47.5079, desc: "Madagascar Central Logistics Center" },
            "toamasina": { lat: -18.1492, lng: 49.4023, desc: "East Coast Port Logistics Hub" },
            "antsirabe": { lat: -19.8659, lng: 47.0333, desc: "Vakinankaratra Logistics Hub" },
            "mahajanga": { lat: -15.7167, lng: 46.3167, desc: "North-West Coast Port Point" },
            "fianarantsoa": { lat: -21.4500, lng: 47.0833, desc: "Haute Matsiatra Logistics Point" },
            "toliara": { lat: -23.3500, lng: 43.6667, desc: "South-West Coast Port Node" },
            // Mauritius
            "port louis": { lat: -20.1608, lng: 57.5012, desc: "Mauritius Port Logistics Hub" },
            "beau bassin-rose hill": { lat: -20.2294, lng: 57.4697, desc: "Plaines Wilhems Distribution Node" },
            "vacoas-phoenix": { lat: -20.2981, lng: 57.4947, desc: "Central Plaines Wilhems Logistics Center" },
            "curepipe": { lat: -20.3167, lng: 57.5167, desc: "Plaines Wilhems Logistics Point" },
            "quatre bornes": { lat: -20.2667, lng: 57.4833, desc: "Central Mauritius Transit Point" },
            // Seychelles
            "victoria": { lat: -4.6167, lng: 55.4500, desc: "Seychelles Port & Primary Logistics Center" },
            "anse boileau": { lat: -4.7167, lng: 55.4833, desc: "Mahe Island Logistics Point" },
            "bel ombre": { lat: -4.6167, lng: 55.4167, desc: "Mahe Island North Logistics Node" },
            "beau vallon": { lat: -4.6167, lng: 55.4333, desc: "Beau Vallon Logistics Point" },
            // Comoros
            "moroni": { lat: -11.7022, lng: 43.2551, desc: "Grande Comore Logistics Hub" },
            "mutsamudu": { lat: -12.1667, lng: 44.4000, desc: "Anjouan Island Port Logistics Hub" },
            "fomboni": { lat: -12.2833, lng: 43.7333, desc: "Moheli Island Transit Node" },
            // Sudan
            "khartoum": { lat: 15.5007, lng: 32.5599, desc: "Sudan Primary Logistics Hub" },
            "omdurman": { lat: 15.6500, lng: 32.4833, desc: "Khartoum State Transit Center" },
            "port sudan": { lat: 19.6158, lng: 37.2164, desc: "Red Sea Port Logistics Hub" },
            "kassala": { lat: 15.4510, lng: 36.4000, desc: "Eastern Border Transit Hub" },
            "el obeid": { lat: 13.1849, lng: 30.2201, desc: "North Kordofan Logistics Node" },
            "nyala": { lat: 12.0500, lng: 24.8833, desc: "South Darfur Logistics Hub" }
          };

          const cleanCountryName = cleanCountry === "drc" ? "democratic republic of the congo" : cleanCountry;
          if (COORDS[cleanCity]) return COORDS[cleanCity];
          if (COORDS[cleanCountryName]) return COORDS[cleanCountryName];

          const COUNTRY_FALLBACKS: Record<string, { lat: number; lng: number; desc: string }> = {
            "kenya": { lat: -1.2921, lng: 36.8219, desc: "Kenya Transit Hub" },
            "uganda": { lat: 0.3476, lng: 32.5825, desc: "Uganda Transit Hub" },
            "tanzania": { lat: -6.7924, lng: 39.2083, desc: "Tanzania Transit Hub" },
            "rwanda": { lat: -1.9403, lng: 30.0619, desc: "Rwanda Transit Hub" },
            "burundi": { lat: -3.3822, lng: 29.3644, desc: "Burundi Transit Hub" },
            "south sudan": { lat: 4.8517, lng: 31.5822, desc: "South Sudan Transit Hub" },
            "somalia": { lat: 2.0439, lng: 45.3438, desc: "Somalia Transit Hub" },
            "democratic republic of the congo": { lat: -4.4419, lng: 15.2663, desc: "DRC Transit Hub" },
            "ethiopia": { lat: 9.0300, lng: 38.7400, desc: "Ethiopia Transit Hub" },
            "eritrea": { lat: 15.3381, lng: 38.9312, desc: "Eritrea Transit Hub" },
            "djibouti": { lat: 11.5880, lng: 43.1450, desc: "Djibouti Transit Hub" },
            "madagascar": { lat: -18.8792, lng: 47.5079, desc: "Madagascar Transit Hub" },
            "mauritius": { lat: -20.1608, lng: 57.5012, desc: "Mauritius Transit Hub" },
            "seychelles": { lat: -4.6167, lng: 55.4500, desc: "Seychelles Transit Hub" },
            "comoros": { lat: -11.7022, lng: 43.2551, desc: "Comoros Transit Hub" },
            "sudan": { lat: 15.5007, lng: 32.5599, desc: "Sudan Transit Hub" }
          };

          return COUNTRY_FALLBACKS[cleanCountryName] || { lat: -1.2921, lng: 36.8219, desc: `${city} active distribution node.` };
        };

        // Extract unique country-city pairs from active shipping destinations AND real defined locations!
        const uniquePairsMap = new Map<string, { city: string; country: string }>();
        
        // 1. From active shipping destinations
        activeDestinations.forEach((dest: any) => {
          if (dest.city && dest.country) {
            const key = `${dest.city.trim().toLowerCase()}, ${dest.country.trim().toLowerCase()}`;
            uniquePairsMap.set(key, { city: dest.city.trim(), country: dest.country.trim() });
          }
        });

        // 2. From real defined locations (countries & cities)
        realLocations.forEach((loc: any) => {
          if (loc.name && loc.cities && loc.is_active !== false) {
            loc.cities.forEach((cityObj: any) => {
              if (cityObj.name && cityObj.is_active !== false) {
                const key = `${cityObj.name.trim().toLowerCase()}, ${loc.name.trim().toLowerCase()}`;
                uniquePairsMap.set(key, { city: cityObj.name.trim(), country: loc.name.trim() });
              }
            });
          }
        });

        const syncedHubs: MapHub[] = [];

        uniquePairsMap.forEach(({ city, country }) => {
          const hubName = `${city}, ${country}`;
          const existing = configuredHubs.find(h => h.name.toLowerCase() === hubName.toLowerCase() || h.name.toLowerCase() === city.toLowerCase());
          
          if (existing) {
            syncedHubs.push({
              name: hubName,
              coords: [parseFloat(existing.lat) || 0, parseFloat(existing.lng) || 0],
              desc: existing.desc || ""
            });
          } else {
            const coords = getCoordinatesForLocation(city, country);
            syncedHubs.push({
              name: hubName,
              coords: [coords.lat, coords.lng],
              desc: ""
            });
          }
        });

        // Fallback to empty if no active shipping destinations exist yet
        if (syncedHubs.length === 0) {
          setHubs([]);
        } else {
          setHubs(syncedHubs);
        }
      } catch (err) {
        console.error("Failed to fetch active zones for map sync, using settings backup:", err);
        // Backup fallback
        let backupHubs: MapHub[] = [];
        if (settings.map_hubs) {
          try {
            const parsed = JSON.parse(settings.map_hubs);
            if (Array.isArray(parsed)) {
              backupHubs = parsed.map(hub => ({
                name: hub.name,
                coords: [hub.lat, hub.lng] as [number, number],
                desc: hub.desc
              }));
            }
          } catch (e) {}
        }
        setHubs(backupHubs);
      }
    };

    fetchActiveZonesAndSyncMap();
  }, [settings.map_hubs]);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-zinc-200 shadow-sm min-h-[350px]">
      <MapContainer 
        center={[-1.2921, 34.8219]} // Centered in East Africa
        zoom={5} 
        scrollWheelZoom={false}
        className="w-full h-full"
        style={{ height: "350px", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hubs.map((hub, idx) => (
          <Marker key={idx} position={hub.coords}>
            <Popup>
              <div className="p-1">
                <h4 className="font-bold text-zinc-900 text-sm mb-0.5">{hub.name}</h4>
                {hub.desc && <p className="text-zinc-500 text-xs my-0 leading-tight">{hub.desc}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
