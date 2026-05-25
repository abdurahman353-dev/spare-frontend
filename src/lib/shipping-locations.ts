export const PREDEFINED_CITIES: Record<string, string[]> = {
  Burundi: ["Bujumbura", "Gitega", "Ngozi", "Rumonge", "Kayanza", "Muyinga", "Makamba", "Kirundo"],
  Comoros: ["Moroni", "Mutsamudu", "Fomboni"],
  Djibouti: ["Djibouti city", "Ali Sabieh", "Tadjoura", "Obock"],
  Eritrea: ["Asmara", "Massawa", "Keren", "Assab", "Mendefera"],
  Ethiopia: ["Addis Ababa", "Dire Dawa", "Bahir Dar", "Gondar", "Mek'ele", "Hawassa", "Jimma", "Adama"],
  Kenya: [
    "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Malindi", "Thika", "Naivasha", "Nyeri",
    "Machakos", "Kakamega", "Kisii", "Kitale", "Garissa", "Lodwar", "Lamu", "Kericho", "Embu",
  ],
  Madagascar: ["Antananarivo", "Toamasina", "Antsirabe", "Mahajanga", "Fianarantsoa", "Toliara"],
  Malawi: ["Lilongwe", "Blantyre", "Mzuzu", "Zomba"],
  Mauritius: ["Port Louis", "Beau Bassin-rose hill", "Vacoas-phoenix", "Curepipe", "Quatre Bornes"],
  Mozambique: ["Maputo", "Beira", "Nampula", "Chimoio"],
  Rwanda: ["Kigali", "Gisenyi", "Butare", "Musanze", "Gitarama", "Kibuye", "Cyangugu", "Rwamagana", "Byumba", "Kibungo"],
  Seychelles: ["Victoria", "Anse Boileau", "Bel Ombre", "Beau Vallon"],
  Somalia: ["Mogadishu", "Hargeisa", "Garowe", "Kismayo", "Bosaso", "Merca", "Baidoa", "Burao"],
  "South Sudan": ["Juba", "Malakal", "Wau", "Yei", "Yambio", "Bor", "Bentiu", "Torit", "Rumbek"],
  Tanzania: [
    "Dar es Salaam", "Dodoma", "Arusha", "Mwanza", "Zanzibar City", "Mbeya", "Morogoro", "Tanga",
    "Tabora", "Moshi", "Kigoma", "Iringa", "Songea", "Musoma",
  ],
  Uganda: [
    "Kampala", "Entebbe", "Jinja", "Gulu", "Mbarara", "Mbale", "Masaka", "Lira", "Arua", "Mukono",
    "Fort Portal", "Soroti", "Kabale", "Hoima", "Tororo",
  ],
  Zambia: ["Lusaka", "Ndola", "Kitwe", "Kabwe", "Livingstone"],
  Zimbabwe: ["Harare", "Bulawayo", "Mutare", "Gweru", "Masvingo"],
};

type CountryRecord = { name: string; cities?: { name: string }[] };

export function getCitiesForCountry(countryName: string, countriesData: CountryRecord[]): string[] {
  const country = countriesData.find((c) => c.name === countryName);
  if (country?.cities?.length) {
    return country.cities.map((ct) => ct.name).sort((a, b) => a.localeCompare(b));
  }
  return PREDEFINED_CITIES[countryName] || [];
}

export function buildFilterCountryOptions(countries: string[]) {
  const unique = Array.from(new Set(countries.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return [{ id: "all", name: "Destination Country" }, ...unique.map((c) => ({ id: c, name: c }))];
}

export function buildFilterCityOptions(
  countryFilter: string,
  fallbackCities: string[],
  countriesData: CountryRecord[]
) {
  if (countryFilter !== "all") {
    const locationCities = getCitiesForCountry(countryFilter, countriesData);
    if (locationCities.length > 0) {
      return [{ id: "all", name: "Destination City" }, ...locationCities.map((c) => ({ id: c, name: c }))];
    }
  }
  const unique = Array.from(new Set(fallbackCities.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return [{ id: "all", name: "Destination City" }, ...unique.map((c) => ({ id: c, name: c }))];
}
