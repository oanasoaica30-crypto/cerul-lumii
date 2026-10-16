/* „Cerul Lumii” — conținut: aeroporturi, avioane, cărți, evenimente, avatare, culori, realizări, replici, sfaturi, reguli.
   window.CerulData (browser) + module.exports (Node). Fără DOM, fără dependențe. Proprietar: agentul DATA.
   Toate textele în română cu diacritice ș/ț cu virgulă. Numerele de echilibru (prețuri, costuri, șanse) sunt în CerulTune;
   aici sunt doar valori de referință (marcate „ref”). */
(function () {
  "use strict";

  /* ======================================================================================================
     CONTINENTE ȘI REGIUNI
     ====================================================================================================== */
  const CONTINENTS = {
    EU: { id: "EU", n: "Europa", icon: "🏰" },
    AS: { id: "AS", n: "Asia", icon: "🏯" },
    NA: { id: "NA", n: "America de Nord", icon: "🗽" },
    SA: { id: "SA", n: "America de Sud", icon: "🌎" },
    AF: { id: "AF", n: "Africa", icon: "🦁" },
    OC: { id: "OC", n: "Oceania", icon: "🦘" }
  };
  const CONT_IDS = Object.keys(CONTINENTS);

  const REGIONS = {
    "eu-n": { n: "Europa de Nord", cont: "EU" },
    "eu-w": { n: "Europa de Vest", cont: "EU" },
    "eu-s": { n: "Europa de Sud", cont: "EU" },
    "eu-e": { n: "Europa de Est", cont: "EU" },
    "me": { n: "Orientul Mijlociu", cont: "AS" },
    "as-c": { n: "Asia Centrală", cont: "AS" },
    "as-s": { n: "Asia de Sud", cont: "AS" },
    "as-se": { n: "Asia de Sud-Est", cont: "AS" },
    "as-e": { n: "Asia de Est", cont: "AS" },
    "na-e": { n: "Coasta de Est (America de Nord)", cont: "NA" },
    "na-w": { n: "Coasta de Vest (America de Nord)", cont: "NA" },
    "na-c": { n: "America Centrală", cont: "NA" },
    "carib": { n: "Caraibe", cont: "NA" },
    "sa-n": { n: "America de Sud (nord)", cont: "SA" },
    "sa-s": { n: "America de Sud (sud)", cont: "SA" },
    "af-n": { n: "Africa de Nord", cont: "AF" },
    "af-w": { n: "Africa de Vest", cont: "AF" },
    "af-e": { n: "Africa de Est", cont: "AF" },
    "af-s": { n: "Africa Australă", cont: "AF" },
    "oc": { n: "Oceania", cont: "OC" }
  };

  /* ======================================================================================================
     ETICHETE (tags) + SEZONALITATE
     SEASON[tag] = 12 multiplicatori (ian..dec) pentru emisfera nordică. seasonMult(ap, month0) îi decalează cu 6 luni
     pentru aeroporturile cu lat < -15 la etichetele cu `shift:true` (plajă, schi, turism, afaceri).
     Rezultatul = produsul multiplicatorilor etichetelor sezoniere, limitat la [0.6, 1.7]. Etichetele fără SEASON = 1.
     ====================================================================================================== */
  const TAGS = {
    "plajă": { n: "Plajă", icon: "🏖️" },
    "schi": { n: "Schi", icon: "⛷️" },
    "afaceri": { n: "Afaceri", icon: "💼" },
    "turism": { n: "Turism", icon: "📸" },
    "cultură": { n: "Cultură", icon: "🏛️" },
    "capitală": { n: "Capitală", icon: "🏙️" },
    "hub": { n: "Nod aerian", icon: "🔁" },
    "tropical": { n: "Tropical", icon: "🌴" },
    "deșert": { n: "Deșert", icon: "🏜️" },
    "natură": { n: "Natură", icon: "🦁" },
    "port": { n: "Port", icon: "⚓" }
  };
  const SEASON = {
    "plajă":    { shift: true,  m: [0.70, 0.70, 0.80, 0.90, 1.00, 1.30, 1.50, 1.50, 1.20, 0.90, 0.75, 0.85] },
    "schi":     { shift: true,  m: [1.50, 1.50, 1.30, 0.90, 0.70, 0.70, 0.80, 0.80, 0.70, 0.80, 1.00, 1.50] },
    "turism":   { shift: true,  m: [0.90, 0.85, 0.95, 1.05, 1.10, 1.20, 1.30, 1.30, 1.15, 1.00, 0.85, 1.00] },
    "afaceri":  { shift: true,  m: [0.95, 1.05, 1.10, 1.05, 1.05, 1.00, 0.80, 0.75, 1.10, 1.10, 1.10, 0.90] },
    "tropical": { shift: false, m: [1.30, 1.30, 1.20, 1.00, 0.85, 0.80, 0.90, 0.90, 0.80, 0.90, 1.00, 1.30] },
    "deșert":   { shift: false, m: [1.20, 1.20, 1.15, 1.00, 0.85, 0.70, 0.70, 0.70, 0.85, 1.05, 1.20, 1.25] }
  };
  const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

  /* ======================================================================================================
     AEROPORTURI (reale). id = cod IATA, n = nume românesc, c = țara, lat/lon în grade (WGS84, poziția aeroportului),
     cont = continent, reg = regiune, size 1 mic / 2 mediu / 3 mare, pop = populația zonei metropolitane în milioane
     (greutatea cererii), tz = fus orar standard (ore față de UTC), tags = etichete.
     ====================================================================================================== */
  const A = (id, n, c, lat, lon, cont, reg, size, pop, tz, tags) => ({ id, n, c, lat, lon, cont, reg, size, pop, tz, tags });
  const AIRPORTS = [
    // ---------- Europa ----------
    A("OTP", "București", "România", 44.571, 26.085, "EU", "eu-e", 2, 2.3, 2, ["capitală", "afaceri"]),
    A("CLJ", "Cluj-Napoca", "România", 46.785, 23.686, "EU", "eu-e", 1, 0.42, 2, ["cultură", "afaceri"]),
    A("TSR", "Timișoara", "România", 45.810, 21.338, "EU", "eu-e", 1, 0.38, 2, ["afaceri", "cultură"]),
    A("IAS", "Iași", "România", 47.179, 27.621, "EU", "eu-e", 1, 0.40, 2, ["cultură"]),
    A("CND", "Constanța", "România", 44.362, 28.488, "EU", "eu-e", 1, 0.42, 2, ["plajă", "port"]),
    A("SOF", "Sofia", "Bulgaria", 42.697, 23.411, "EU", "eu-e", 1, 1.3, 2, ["capitală", "schi"]),
    A("BUD", "Budapesta", "Ungaria", 47.437, 19.256, "EU", "eu-e", 2, 3.0, 1, ["capitală", "turism"]),
    A("WAW", "Varșovia", "Polonia", 52.166, 20.967, "EU", "eu-e", 2, 3.1, 1, ["capitală", "afaceri"]),
    A("PRG", "Praga", "Cehia", 50.101, 14.260, "EU", "eu-e", 2, 2.7, 1, ["turism", "cultură"]),
    A("SVO", "Moscova", "Rusia", 55.973, 37.415, "EU", "eu-e", 3, 17.0, 3, ["capitală", "afaceri"]),
    A("IST", "Istanbul", "Turcia", 41.275, 28.752, "EU", "eu-e", 3, 15.6, 3, ["hub", "turism", "cultură"]),
    A("ATH", "Atena", "Grecia", 37.936, 23.945, "EU", "eu-s", 2, 3.6, 2, ["capitală", "plajă", "cultură"]),
    A("FCO", "Roma", "Italia", 41.800, 12.239, "EU", "eu-s", 3, 4.3, 1, ["capitală", "cultură", "turism"]),
    A("MXP", "Milano", "Italia", 45.631, 8.728, "EU", "eu-s", 2, 4.3, 1, ["afaceri", "schi"]),
    A("MAD", "Madrid", "Spania", 40.472, -3.563, "EU", "eu-s", 3, 6.8, 1, ["capitală", "afaceri"]),
    A("BCN", "Barcelona", "Spania", 41.297, 2.083, "EU", "eu-s", 2, 5.6, 1, ["plajă", "turism"]),
    A("PMI", "Palma de Mallorca", "Spania", 39.552, 2.739, "EU", "eu-s", 1, 0.45, 1, ["plajă"]),
    A("LIS", "Lisabona", "Portugalia", 38.774, -9.134, "EU", "eu-s", 2, 2.9, 0, ["capitală", "plajă", "turism"]),
    A("NCE", "Nisa", "Franța", 43.658, 7.216, "EU", "eu-s", 1, 1.0, 1, ["plajă", "turism"]),
    A("LHR", "Londra", "Regatul Unit", 51.470, -0.454, "EU", "eu-w", 3, 14.3, 0, ["capitală", "afaceri", "turism"]),
    A("CDG", "Paris", "Franța", 49.010, 2.548, "EU", "eu-w", 3, 12.5, 1, ["capitală", "turism", "cultură"]),
    A("FRA", "Frankfurt", "Germania", 50.038, 8.562, "EU", "eu-w", 3, 5.8, 1, ["afaceri", "hub"]),
    A("AMS", "Amsterdam", "Țările de Jos", 52.311, 4.768, "EU", "eu-w", 3, 2.5, 1, ["turism", "hub"]),
    A("BER", "Berlin", "Germania", 52.367, 13.503, "EU", "eu-w", 2, 4.5, 1, ["capitală", "cultură"]),
    A("MUC", "München", "Germania", 48.354, 11.786, "EU", "eu-w", 2, 2.9, 1, ["afaceri", "schi"]),
    A("ZRH", "Zürich", "Elveția", 47.465, 8.549, "EU", "eu-w", 2, 1.4, 1, ["afaceri", "schi"]),
    A("VIE", "Viena", "Austria", 48.110, 16.570, "EU", "eu-w", 2, 2.9, 1, ["capitală", "cultură"]),
    A("INN", "Innsbruck", "Austria", 47.260, 11.344, "EU", "eu-w", 1, 0.3, 1, ["schi", "turism"]),
    A("DUB", "Dublin", "Irlanda", 53.421, -6.270, "EU", "eu-w", 2, 1.4, 0, ["capitală", "afaceri"]),
    A("CPH", "Copenhaga", "Danemarca", 55.618, 12.651, "EU", "eu-n", 2, 2.1, 1, ["capitală", "hub"]),
    A("ARN", "Stockholm", "Suedia", 59.650, 17.924, "EU", "eu-n", 2, 2.4, 1, ["capitală", "afaceri"]),
    A("OSL", "Oslo", "Norvegia", 60.198, 11.100, "EU", "eu-n", 2, 1.5, 1, ["capitală", "schi"]),
    A("HEL", "Helsinki", "Finlanda", 60.317, 24.963, "EU", "eu-n", 2, 1.5, 2, ["capitală"]),
    A("KEF", "Reykjavík", "Islanda", 63.985, -22.606, "EU", "eu-n", 1, 0.24, 0, ["natură", "turism"]),
    // ---------- Asia: Orientul Mijlociu ----------
    A("DXB", "Dubai", "Emiratele Arabe Unite", 25.253, 55.366, "AS", "me", 3, 3.6, 4, ["hub", "afaceri", "deșert", "turism"]),
    A("DOH", "Doha", "Qatar", 25.273, 51.608, "AS", "me", 2, 2.4, 3, ["hub", "capitală", "deșert"]),
    A("TLV", "Tel Aviv", "Israel", 32.011, 34.887, "AS", "me", 2, 4.2, 2, ["afaceri", "plajă"]),
    A("RUH", "Riad", "Arabia Saudită", 24.958, 46.699, "AS", "me", 2, 7.7, 3, ["capitală", "afaceri", "deșert"]),
    A("IKA", "Teheran", "Iran", 35.416, 51.152, "AS", "me", 2, 9.4, 3.5, ["capitală", "cultură"]),
    A("AYT", "Antalya", "Turcia", 36.899, 30.801, "AS", "me", 1, 2.6, 3, ["plajă", "turism"]),
    // ---------- Asia Centrală și de Sud ----------
    A("ALA", "Almatî", "Kazahstan", 43.352, 77.041, "AS", "as-c", 1, 2.2, 5, ["afaceri", "schi"]),
    A("TAS", "Tașkent", "Uzbekistan", 41.258, 69.281, "AS", "as-c", 1, 2.9, 5, ["capitală", "cultură"]),
    A("DEL", "Delhi", "India", 28.556, 77.100, "AS", "as-s", 3, 32.0, 5.5, ["capitală", "cultură", "afaceri"]),
    A("BOM", "Mumbai", "India", 19.090, 72.866, "AS", "as-s", 3, 21.0, 5.5, ["afaceri", "port"]),
    A("BLR", "Bangalore", "India", 13.199, 77.707, "AS", "as-s", 2, 13.0, 5.5, ["afaceri"]),
    A("KTM", "Kathmandu", "Nepal", 27.697, 85.359, "AS", "as-s", 1, 3.0, 5.75, ["natură", "turism", "capitală"]),
    A("CMB", "Colombo", "Sri Lanka", 7.181, 79.884, "AS", "as-s", 1, 5.6, 5.5, ["plajă", "tropical"]),
    A("MLE", "Malé", "Maldive", 4.192, 73.529, "AS", "as-s", 1, 0.25, 5, ["plajă", "tropical"]),
    // ---------- Asia de Sud-Est ----------
    A("SIN", "Singapore", "Singapore", 1.364, 103.992, "AS", "as-se", 3, 6.0, 8, ["hub", "afaceri", "tropical"]),
    A("BKK", "Bangkok", "Thailanda", 13.690, 100.750, "AS", "as-se", 3, 17.0, 7, ["capitală", "turism", "tropical"]),
    A("HKT", "Phuket", "Thailanda", 8.113, 98.317, "AS", "as-se", 1, 0.4, 7, ["plajă", "tropical"]),
    A("KUL", "Kuala Lumpur", "Malaysia", 2.746, 101.710, "AS", "as-se", 2, 8.4, 8, ["capitală", "afaceri", "tropical"]),
    A("CGK", "Jakarta", "Indonezia", -6.126, 106.656, "AS", "as-se", 3, 33.0, 7, ["capitală", "afaceri", "tropical"]),
    A("DPS", "Bali", "Indonezia", -8.748, 115.168, "AS", "as-se", 2, 4.3, 8, ["plajă", "tropical", "turism"]),
    A("MNL", "Manila", "Filipine", 14.509, 121.020, "AS", "as-se", 2, 24.0, 8, ["capitală", "tropical"]),
    A("SGN", "Ho Chi Minh", "Vietnam", 10.819, 106.652, "AS", "as-se", 2, 9.0, 7, ["afaceri", "tropical"]),
    // ---------- Asia de Est ----------
    A("HND", "Tokio", "Japonia", 35.549, 139.780, "AS", "as-e", 3, 37.0, 9, ["capitală", "afaceri", "cultură"]),
    A("KIX", "Osaka", "Japonia", 34.435, 135.244, "AS", "as-e", 2, 19.0, 9, ["afaceri", "cultură", "turism"]),
    A("ICN", "Seul", "Coreea de Sud", 37.460, 126.441, "AS", "as-e", 3, 25.0, 9, ["capitală", "afaceri", "hub"]),
    A("PEK", "Beijing", "China", 40.080, 116.603, "AS", "as-e", 3, 21.5, 8, ["capitală", "cultură"]),
    A("PVG", "Shanghai", "China", 31.144, 121.808, "AS", "as-e", 3, 29.0, 8, ["afaceri", "port"]),
    A("CAN", "Guangzhou", "China", 23.392, 113.299, "AS", "as-e", 2, 19.0, 8, ["afaceri"]),
    A("CTU", "Chengdu", "China", 30.579, 103.947, "AS", "as-e", 2, 16.0, 8, ["natură", "cultură"]),
    A("HKG", "Hong Kong", "China", 22.308, 113.918, "AS", "as-e", 3, 7.5, 8, ["hub", "afaceri", "port"]),
    A("TPE", "Taipei", "Taiwan", 25.080, 121.234, "AS", "as-e", 2, 7.0, 8, ["afaceri"]),
    // ---------- America de Nord ----------
    A("JFK", "New York", "SUA", 40.641, -73.778, "NA", "na-e", 3, 20.0, -5, ["afaceri", "turism", "cultură"]),
    A("BOS", "Boston", "SUA", 42.366, -71.010, "NA", "na-e", 2, 4.9, -5, ["afaceri", "cultură"]),
    A("IAD", "Washington", "SUA", 38.953, -77.457, "NA", "na-e", 2, 6.3, -5, ["capitală", "afaceri"]),
    A("ATL", "Atlanta", "SUA", 33.641, -84.428, "NA", "na-e", 3, 6.2, -5, ["hub", "afaceri"]),
    A("MIA", "Miami", "SUA", 25.796, -80.287, "NA", "na-e", 2, 6.1, -5, ["plajă", "tropical", "hub"]),
    A("ORD", "Chicago", "SUA", 41.974, -87.907, "NA", "na-e", 3, 9.5, -6, ["hub", "afaceri"]),
    A("YYZ", "Toronto", "Canada", 43.678, -79.625, "NA", "na-e", 3, 6.7, -5, ["afaceri", "hub"]),
    A("YUL", "Montréal", "Canada", 45.471, -73.741, "NA", "na-e", 2, 4.3, -5, ["cultură", "schi"]),
    A("DFW", "Dallas", "SUA", 32.900, -97.040, "NA", "na-w", 3, 7.6, -6, ["hub", "afaceri"]),
    A("DEN", "Denver", "SUA", 39.856, -104.674, "NA", "na-w", 2, 3.0, -7, ["schi", "hub"]),
    A("LAX", "Los Angeles", "SUA", 33.942, -118.409, "NA", "na-w", 3, 13.0, -8, ["plajă", "turism", "afaceri"]),
    A("SFO", "San Francisco", "SUA", 37.621, -122.379, "NA", "na-w", 2, 4.7, -8, ["afaceri", "turism"]),
    A("SEA", "Seattle", "SUA", 47.450, -122.309, "NA", "na-w", 2, 4.0, -8, ["afaceri", "natură"]),
    A("LAS", "Las Vegas", "SUA", 36.084, -115.154, "NA", "na-w", 2, 2.3, -8, ["turism", "deșert"]),
    A("YVR", "Vancouver", "Canada", 49.197, -123.182, "NA", "na-w", 2, 2.6, -8, ["schi", "natură"]),
    A("ANC", "Anchorage", "SUA", 61.174, -149.996, "NA", "na-w", 1, 0.4, -9, ["natură"]),
    A("HNL", "Honolulu", "SUA", 21.319, -157.923, "NA", "na-w", 1, 1.0, -10, ["plajă", "tropical", "turism"]),
    A("MEX", "Ciudad de México", "Mexic", 19.436, -99.072, "NA", "na-c", 3, 22.0, -6, ["capitală", "cultură", "afaceri"]),
    A("CUN", "Cancún", "Mexic", 21.037, -86.877, "NA", "na-c", 2, 0.9, -5, ["plajă", "tropical", "turism"]),
    A("PTY", "Panama", "Panama", 9.071, -79.384, "NA", "na-c", 2, 1.9, -5, ["hub", "capitală", "tropical"]),
    A("HAV", "Havana", "Cuba", 22.989, -82.409, "NA", "carib", 1, 2.1, -5, ["capitală", "plajă", "cultură"]),
    A("SJU", "San Juan", "Puerto Rico", 18.439, -66.002, "NA", "carib", 1, 2.4, -4, ["plajă", "tropical"]),
    A("PUJ", "Punta Cana", "Republica Dominicană", 18.567, -68.363, "NA", "carib", 1, 0.5, -4, ["plajă", "tropical"]),
    // ---------- America de Sud ----------
    A("BOG", "Bogotá", "Columbia", 4.702, -74.147, "SA", "sa-n", 2, 11.0, -5, ["capitală", "afaceri"]),
    A("MDE", "Medellín", "Columbia", 6.165, -75.423, "SA", "sa-n", 1, 4.0, -5, ["turism"]),
    A("CCS", "Caracas", "Venezuela", 10.603, -66.991, "SA", "sa-n", 1, 5.0, -4, ["capitală", "plajă"]),
    A("UIO", "Quito", "Ecuador", -0.129, -78.358, "SA", "sa-n", 1, 2.8, -5, ["capitală", "natură"]),
    A("LIM", "Lima", "Peru", -12.022, -77.114, "SA", "sa-n", 2, 11.0, -5, ["capitală", "hub"]),
    A("CUZ", "Cusco", "Peru", -13.536, -71.939, "SA", "sa-n", 1, 0.45, -5, ["turism", "cultură", "natură"]),
    A("REC", "Recife", "Brazilia", -8.126, -34.924, "SA", "sa-n", 1, 4.0, -3, ["plajă", "tropical"]),
    A("SSA", "Salvador", "Brazilia", -12.909, -38.323, "SA", "sa-n", 1, 4.0, -3, ["plajă", "cultură"]),
    A("BSB", "Brasília", "Brazilia", -15.870, -47.921, "SA", "sa-s", 2, 4.8, -3, ["capitală", "afaceri"]),
    A("GRU", "São Paulo", "Brazilia", -23.436, -46.473, "SA", "sa-s", 3, 22.0, -3, ["afaceri", "hub"]),
    A("GIG", "Rio de Janeiro", "Brazilia", -22.810, -43.251, "SA", "sa-s", 2, 13.5, -3, ["plajă", "turism"]),
    A("MVD", "Montevideo", "Uruguay", -34.838, -56.031, "SA", "sa-s", 1, 1.9, -3, ["capitală", "plajă"]),
    A("EZE", "Buenos Aires", "Argentina", -34.822, -58.536, "SA", "sa-s", 3, 15.5, -3, ["capitală", "cultură", "afaceri"]),
    A("SCL", "Santiago de Chile", "Chile", -33.393, -70.786, "SA", "sa-s", 2, 7.0, -4, ["capitală", "schi"]),
    A("USH", "Ushuaia", "Argentina", -54.843, -68.296, "SA", "sa-s", 1, 0.08, -3, ["natură", "turism"]),
    // ---------- Africa ----------
    A("CAI", "Cairo", "Egipt", 30.122, 31.406, "AF", "af-n", 3, 21.0, 2, ["capitală", "cultură", "deșert"]),
    A("SSH", "Sharm el-Sheikh", "Egipt", 27.977, 34.395, "AF", "af-n", 1, 0.07, 2, ["plajă", "deșert"]),
    A("CMN", "Casablanca", "Maroc", 33.368, -7.590, "AF", "af-n", 2, 4.3, 1, ["afaceri", "port"]),
    A("RAK", "Marrakech", "Maroc", 31.607, -8.036, "AF", "af-n", 1, 1.3, 1, ["turism", "deșert", "cultură"]),
    A("ALG", "Alger", "Algeria", 36.691, 3.215, "AF", "af-n", 2, 3.9, 1, ["capitală"]),
    A("TUN", "Tunis", "Tunisia", 36.851, 10.227, "AF", "af-n", 1, 2.7, 1, ["capitală", "plajă"]),
    A("DSS", "Dakar", "Senegal", 14.670, -17.073, "AF", "af-w", 1, 3.3, 0, ["capitală", "plajă"]),
    A("ACC", "Accra", "Ghana", 5.605, -0.167, "AF", "af-w", 1, 2.6, 0, ["capitală", "afaceri"]),
    A("LOS", "Lagos", "Nigeria", 6.577, 3.321, "AF", "af-w", 3, 15.0, 1, ["afaceri", "port"]),
    A("FIH", "Kinshasa", "R.D. Congo", -4.386, 15.445, "AF", "af-w", 1, 15.0, 1, ["capitală"]),
    A("LAD", "Luanda", "Angola", -8.858, 13.231, "AF", "af-w", 1, 9.0, 1, ["capitală", "afaceri"]),
    A("ADD", "Addis Abeba", "Etiopia", 8.978, 38.799, "AF", "af-e", 2, 5.4, 3, ["hub", "capitală"]),
    A("NBO", "Nairobi", "Kenya", -1.319, 36.928, "AF", "af-e", 2, 5.3, 3, ["capitală", "natură", "afaceri"]),
    A("DAR", "Dar es Salaam", "Tanzania", -6.878, 39.203, "AF", "af-e", 1, 7.4, 3, ["afaceri", "port"]),
    A("ZNZ", "Zanzibar", "Tanzania", -6.222, 39.225, "AF", "af-e", 1, 0.9, 3, ["plajă", "tropical"]),
    A("MRU", "Mauritius", "Mauritius", -20.430, 57.684, "AF", "af-e", 1, 1.3, 4, ["plajă", "tropical"]),
    A("JNB", "Johannesburg", "Africa de Sud", -26.139, 28.246, "AF", "af-s", 3, 10.0, 2, ["afaceri", "hub"]),
    A("CPT", "Cape Town", "Africa de Sud", -33.972, 18.602, "AF", "af-s", 2, 4.8, 2, ["plajă", "turism", "natură"]),
    // ---------- Oceania ----------
    A("SYD", "Sydney", "Australia", -33.940, 151.175, "OC", "oc", 3, 5.3, 10, ["plajă", "turism", "afaceri"]),
    A("MEL", "Melbourne", "Australia", -37.669, 144.841, "OC", "oc", 2, 5.1, 10, ["cultură", "afaceri"]),
    A("BNE", "Brisbane", "Australia", -27.384, 153.118, "OC", "oc", 2, 2.6, 10, ["plajă"]),
    A("PER", "Perth", "Australia", -31.939, 115.967, "OC", "oc", 2, 2.1, 8, ["afaceri", "plajă"]),
    A("ADL", "Adelaide", "Australia", -34.945, 138.531, "OC", "oc", 1, 1.4, 9.5, ["cultură"]),
    A("CNS", "Cairns", "Australia", -16.886, 145.755, "OC", "oc", 1, 0.25, 10, ["plajă", "tropical", "natură"]),
    A("POM", "Port Moresby", "Papua Noua Guinee", -9.443, 147.220, "OC", "oc", 1, 0.4, 10, ["capitală", "natură"]),
    A("AKL", "Auckland", "Noua Zeelandă", -37.008, 174.785, "OC", "oc", 2, 1.7, 12, ["turism", "afaceri"]),
    A("CHC", "Christchurch", "Noua Zeelandă", -43.489, 172.532, "OC", "oc", 1, 0.4, 12, ["schi", "natură"]),
    A("NOU", "Nouméa", "Noua Caledonie", -22.015, 166.213, "OC", "oc", 1, 0.2, 11, ["plajă", "tropical"]),
    A("NAN", "Fiji", "Fiji", -17.755, 177.443, "OC", "oc", 1, 0.9, 12, ["plajă", "tropical"]),
    A("PPT", "Tahiti", "Polinezia Franceză", -17.554, -149.607, "OC", "oc", 1, 0.2, -10, ["plajă", "tropical"])
  ];
  const AP = {};
  AIRPORTS.forEach((a, i) => { a.i = i; AP[a.id] = a; });
  const AP_IDS = AIRPORTS.map(a => a.id);
  const SIZE_NAMES = { 1: "mic", 2: "mediu", 3: "mare" };

  function seasonMult(ap, month0) {
    if (typeof ap === "string") ap = AP[ap];
    if (!ap) return 1;
    const m = ((month0 | 0) % 12 + 12) % 12;
    let r = 1;
    (ap.tags || []).forEach(t => {
      const s = SEASON[t]; if (!s) return;
      const mm = (s.shift && ap.lat < -15) ? (m + 6) % 12 : m;
      r *= s.m[mm];
    });
    return Math.max(0.6, Math.min(1.7, r));
  }

  /* ======================================================================================================
     DISTANȚĂ + FORMATARE
     ====================================================================================================== */
  const R_EARTH = 6371;
  const _dc = {};
  function _ap(x) { return typeof x === "string" ? AP[x] : x; }
  /** dist(a, b) — distanța ortodromică în km (întreg). a/b = cod IATA sau obiect {lat, lon}. */
  function dist(a, b) {
    const ka = typeof a === "string" ? a : null, kb = typeof b === "string" ? b : null;
    const key = ka && kb ? (ka < kb ? ka + kb : kb + ka) : null;
    if (key && _dc[key] != null) return _dc[key];
    const A1 = _ap(a), B1 = _ap(b);
    if (!A1 || !B1) return NaN;
    const toR = Math.PI / 180;
    const dLat = (B1.lat - A1.lat) * toR, dLon = (B1.lon - A1.lon) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(A1.lat * toR) * Math.cos(B1.lat * toR) * Math.sin(dLon / 2) ** 2;
    const d = Math.round(2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h))));
    if (key) _dc[key] = d;
    return d;
  }
  /** Clasa de distanță pentru permise: "scurt" < 1500 km ≤ "mediu" < 4500 km ≤ "lung" (ref; LOGIC/TUNE pot redefini). */
  function distClass(km) { return km < 1500 ? "scurt" : km < 4500 ? "mediu" : "lung"; }
  /** Punct intermediar pe ortodromă (f ∈ [0,1]) → {lat, lon}; util pentru MAP/LOGIC.planePos. */
  function gcPoint(a, b, f) {
    const A1 = _ap(a), B1 = _ap(b), toR = Math.PI / 180, toD = 180 / Math.PI;
    const p1 = A1.lat * toR, l1 = A1.lon * toR, p2 = B1.lat * toR, l2 = B1.lon * toR;
    const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
    if (d < 1e-9) return { lat: A1.lat, lon: A1.lon };
    const s = Math.sin(d), ka = Math.sin((1 - f) * d) / s, kb = Math.sin(f * d) / s;
    const x = ka * Math.cos(p1) * Math.cos(l1) + kb * Math.cos(p2) * Math.cos(l2);
    const y = ka * Math.cos(p1) * Math.sin(l1) + kb * Math.cos(p2) * Math.sin(l2);
    const z = ka * Math.sin(p1) + kb * Math.sin(p2);
    return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * toD, lon: Math.atan2(y, x) * toD };
  }
  /** Direcția inițială (grade, 0 = nord, sens orar) de la a spre b. */
  function bearing(a, b) {
    const A1 = _ap(a), B1 = _ap(b), toR = Math.PI / 180;
    const p1 = A1.lat * toR, p2 = B1.lat * toR, dl = (B1.lon - A1.lon) * toR;
    const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function _thousands(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  /** fmtEur(n): ≥ 1 mld → „1,2 mld €”; ≥ 1 M → „1,25 M €” (max 2 zecimale, fără zerouri inutile); altfel „48.200 €”. */
  function fmtEur(n) {
    n = Number(n) || 0;
    const neg = n < 0; let v = Math.abs(n), s;
    if (v >= 1e9) s = (Math.round(v / 1e7) / 100).toFixed(2).replace(/\.?0+$/, "").replace(".", ",") + " mld €";
    else if (v >= 1e6) s = (Math.round(v / 1e4) / 100).toFixed(2).replace(/\.?0+$/, "").replace(".", ",") + " M €";
    else s = _thousands(Math.round(v)) + " €";
    return (neg ? "−" : "") + s;
  }
  /** fmtKm(n) → „1.234 km”. */
  function fmtKm(n) { return _thousands(Math.round(Number(n) || 0)) + " km"; }

  /* ======================================================================================================
     AVIOANE (nume inventate). Valorile numerice sunt de REFERINȚĂ — sursa de adevăr e CerulTune.PLANES.
     ====================================================================================================== */
  const AIRCRAFT = {
    t72: {
      id: "t72", n: "Turbo 72", cls: "regional", nCls: "Regional cu elice",
      d: "Turbopropulsor mic și cuminte, cu elice care cântă. Ideal pentru rute scurte, piste mici și bugete strânse. Nu se sperie de aeroporturile de provincie.",
      short: "Mic, ieftin, perfect pentru rute scurte.",
      ref: { seats: 70, range: 1800, speed: 520, price: 3000000 },
      engines: "2 turbopropulsoare", crew: "2 piloți, 2 însoțitori"
    },
    a320: {
      id: "a320", n: "Aero 320", cls: "mediu", nCls: "Mediu-curier cu reacție",
      d: "Calul de povară al cerului: un jet cu un singur culoar, rapid și economic, care leagă capitalele continentului de dimineața până seara.",
      short: "Echilibrat: locuri multe, rază medie.",
      ref: { seats: 180, range: 5000, speed: 840, price: 9000000 },
      engines: "2 motoare cu reacție", crew: "2 piloți, 4 însoțitori"
    },
    s350: {
      id: "s350", n: "Skyliner 350", cls: "lung", nCls: "Lung-curier cu fuzelaj larg",
      d: "Uriașul elegant cu două culoare: traversează oceanele dintr-o suflare și duce sute de pasageri între continente. Scump, dar impunător.",
      short: "Gigantul intercontinental.",
      ref: { seats: 320, range: 14500, speed: 900, price: 24000000 },
      engines: "2 motoare cu reacție de mare tracțiune", crew: "3 piloți, 9 însoțitori"
    },
    c40: {
      id: "c40", n: "Colibri 40", cls: "navetă", nCls: "Navetă mică cu elice",
      d: "Cel mai mic din flotă: 40 de locuri, două elice și un preț de nimic. Sare între orașe apropiate de mai multe ori pe zi și se umple ușor chiar și pe rutele cu puțini pasageri.",
      short: "Foarte ieftin, pentru salturi scurte și rute mici.",
      ref: { seats: 40, range: 1100, speed: 460, price: 1200000 },
      engines: "2 turbopropulsoare mici", crew: "2 piloți, 1 însoțitor"
    },
    r100: {
      id: "r100", n: "Regio 100", cls: "regional", nCls: "Jet regional",
      d: "Un jet suplu de o sută de locuri: rapid ca un avion mare, dar cu costuri de avion mic. Potrivit pentru rutele de pe continent pe care un Aero 320 ar zbura pe jumătate gol.",
      short: "Jet regional rapid, rute de până la 3.000 km.",
      ref: { seats: 100, range: 3000, speed: 780, price: 5500000 },
      engines: "2 motoare cu reacție", crew: "2 piloți, 3 însoțitori"
    },
    c230: {
      id: "c230", n: "Cometa 230", cls: "lung", nCls: "Lung-curier mediu",
      d: "Trece oceanul fără să aibă nevoie de cererea unui gigant: 230 de locuri și autonomie mare. Ideal pentru rutele lungi cu cerere medie.",
      short: "Rute lungi cu cerere medie (până la 8.500 km).",
      ref: { seats: 230, range: 8500, speed: 860, price: 15000000 },
      engines: "2 motoare cu reacție", crew: "2 piloți, 6 însoțitori"
    }
  };
  const AIRCRAFT_IDS = Object.keys(AIRCRAFT);          // INDEX = tipul (ty) din logică: t72, a320, s350, c40, r100, c230
  const PLANE_ORDER = [3, 0, 4, 1, 5, 2];               // afișare de la mic la mare (indici ty)

  /* ======================================================================================================
     CĂRȚI
     kind: "res" (resursă normală), "joker" (înlocuiește orice resursă normală), "special".
     CARD_ODDS = șansele de tragere (ref, CerulTune.CARD_ODDS are prioritate). „special” = 6% → o carte din pool-ul
     de speciale dacă mai există (altfel o resursă normală aleatoare).
     SPECIALS[id]: count = câte există în pool, max = câte poate ține un jucător (null = nelimitat),
     target: "company" (o companie adversă) | "route" (o rută proprie) | "routeAny" (o rută a unui adversar) |
             "permit" (alege un permis fezabil) | "build" (se aplică la următoarea construcție) | "airport" (aeroport mare plin) |
             "none" (efect imediat) | "event" (reacție la un eveniment) | "reaction" (doar ca răspuns la îngheț).
     ====================================================================================================== */
  const CARDS = {
    aprobare:    { id: "aprobare", kind: "res", n: "Aprobare", icon: "🛂", color: "#3d8bfd", d: "Ștampile, semnături și avize de la autoritatea aviației civile." },
    infra:       { id: "infra", kind: "res", n: "Infrastructură", icon: "🏗️", color: "#f59f2a", d: "Porți de îmbarcare, benzi de bagaje și ghișee la aeroport." },
    echipaj:     { id: "echipaj", kind: "res", n: "Echipaj", icon: "👨‍✈️", color: "#2fbf71", d: "Piloți, însoțitori de bord și mecanici pregătiți pentru ruta nouă." },
    combustibil: { id: "combustibil", kind: "res", n: "Combustibil", icon: "⛽", color: "#e8455a", d: "Contracte de alimentare cu kerosen la ambele capete ale rutei." },
    joker:       { id: "joker", kind: "joker", n: "Joker", icon: "⭐", color: "#ffd447", d: "Ține locul oricărei cărți de resursă (Aprobare, Infrastructură, Echipaj sau Combustibil)." },

    freeze: { id: "freeze", kind: "special", n: "Îngheață timpul", icon: "❄️", color: "#7fd8ff",
      d: "Alege o companie adversă: timp de 30 de secunde reale operațiunile ei îngheață — avioanele stau pe loc (chiar și în aer), nu se îmbarcă și nu decolează nimeni, iar ea nu poate face nimic în afară de a privi și a juca 🔥 Spărgător de gheață. Pe rutele comune, toată cererea nouă vine la tine.",
      limits: "Max. 3 în mână. Următorul îngheț abia după 2 zile de joc. Nu în timpul negocierii, draftului sau pauzei; nu pe o companie deja înghețată; nu împotriva unui partener de pact." },
    breaker: { id: "breaker", kind: "special", n: "Spărgător de gheață", icon: "🔥", color: "#ff7a2f",
      d: "Când cineva te îngheață, primești 5 secunde să răspunzi „Folosești Spărgătorul?”. Dacă da, înghețul e anulat pe loc.",
      limits: "Max. 2 în mână. Se joacă doar ca reacție la ❄️." },
    fastbuild: { id: "fastbuild", kind: "special", n: "Construcție rapidă", icon: "🚀", color: "#ff5ca8",
      d: "Construiește o rută cu o carte de resursă mai puțin decât cere permisul.", limits: "" },
    vip: { id: "vip", kind: "special", n: "Permis VIP", icon: "🎟️", color: "#c38bff",
      d: "Alege liber orice permis fezabil din rețeaua ta, fără tragere la sorți. Ocupă un loc de permis deschis.", limits: "Ai nevoie de un loc liber de permis (max. 3 deschise)." },
    boom: { id: "boom", kind: "special", n: "Boom de pasageri", icon: "📈", color: "#4ade80",
      d: "Una dintre rutele tale primește cerere dublă (×2) timp de 3 zile de joc.", limits: "" },
    fuel: { id: "fuel", kind: "special", n: "Contract de combustibil", icon: "⛽", color: "#f97316",
      d: "Plătești cu 30% mai puțin pe combustibil timp de 5 zile de joc.", limits: "" },
    spy: { id: "spy", kind: "special", n: "Spion", icon: "🔍", color: "#94a3b8",
      d: "Alege o rută a unui adversar: vezi prețul biletelor și profitul ei timp de o zi de joc.", limits: "" },
    ads: { id: "ads", kind: "special", n: "Campanie de reclamă", icon: "📣", color: "#facc15",
      d: "Reputația companiei tale crește cu o stea (+1 ⭐) timp de 7 zile de joc.", limits: "Maximum 5 stele." },
    insurance: { id: "insurance", kind: "special", n: "Asigurare", icon: "🧯", color: "#ef4444",
      d: "Anulează un eveniment negativ care te lovește (îl poți juca atunci când apare evenimentul).", limits: "" },
    slot: { id: "slot", kind: "special", n: "Slot suplimentar", icon: "🏛️", color: "#38bdf8",
      d: "Primești un slot în plus la un aeroport mare deja plin — doar pentru tine.", limits: "" },
    giftplane: { id: "giftplane", kind: "special", n: "Avion cadou", icon: "✈️", color: "#a3e635",
      d: "Primești gratuit un Turbo 72 nou-nouț, la baza ta.", limits: "" }
  };
  const RES_IDS = ["aprobare", "infra", "echipaj", "combustibil"];
  const SPECIAL_IDS = ["freeze", "breaker", "fastbuild", "vip", "boom", "fuel", "spy", "ads", "insurance", "slot", "giftplane"];
  const CARD_ODDS = { aprobare: 0.22, infra: 0.22, echipaj: 0.22, combustibil: 0.22, joker: 0.06, special: 0.06 };
  const SPECIALS = {
    freeze:    { count: 6, max: 3, target: "company", realSec: 30, cooldownDays: 2 },
    breaker:   { count: 4, max: 2, target: "reaction", promptSec: 5 },
    fastbuild: { count: 4, max: null, target: "build", cardsLess: 1 },
    vip:       { count: 3, max: null, target: "permit" },
    boom:      { count: 4, max: null, target: "route", mult: 2, days: 3 },
    fuel:      { count: 3, max: null, target: "none", mult: 0.7, days: 5 },
    spy:       { count: 3, max: null, target: "routeAny", days: 1 },
    ads:       { count: 4, max: null, target: "none", stars: 1, days: 7 },
    insurance: { count: 3, max: null, target: "event" },
    slot:      { count: 2, max: null, target: "airport" },
    giftplane: { count: 1, max: null, target: "none", plane: "t72" }
  };
  const SPECIAL_RETURN_DAYS = 10; // o carte specială jucată revine în pool după 10 zile de joc (ref; CerulTune poate suprascrie)
  const SPECIAL_POOL_TOTAL = SPECIAL_IDS.reduce((s, k) => s + SPECIALS[k].count, 0); // 37
  SPECIAL_IDS.forEach(k => Object.assign(CARDS[k], SPECIALS[k]));
  function cardName(id) { const c = CARDS[id]; return c ? c.icon + " " + c.n : String(id); }

  /* ======================================================================================================
     EVENIMENTE — declarative. LOGIC le aplică; vezi FX_DOC pentru semantica exactă a fiecărei chei.
     Câmpuri: id, n (titlu), icon, mood "bun"|"rau"|"neutru", neg (true = negativ → poate fi anulat cu 🧯 Asigurare de cine e
     lovit), w (greutate la tragere), days (durata în zile de joc; 0 = permanent), months (opțional: doar în aceste luni 1..12,
     după data jocului), minDay (opțional), crisis (true = probabilitate crescută în „Fără timp” după ziua 60),
     scope (pe cine/unde se aplică), fx (efecte), d (text pentru anunț, cu {loc} = locul/țintele ales(e) și {p} = compania țintă).
     ====================================================================================================== */
  const SCOPE_DOC = {
    global: "{type:'global'} — toată lumea / toate aeroporturile.",
    airport: "{type:'airport', minSize?, tag?, ids?, n?} — alege aleator n (implicit 1) aeroporturi care respectă filtrele (size ≥ minSize, are eticheta tag, id ∈ ids). {loc} = numele lor.",
    region: "{type:'region', regs:[...]} — alege aleator o regiune din listă; ținte = toate aeroporturile cu ap.reg === regiunea. {loc} = REGIONS[reg].n.",
    cont: "{type:'cont', conts?:[...]} — alege un continent (din listă sau oricare); ținte = aeroporturile cu ap.cont. {loc} = CONTINENTS[c].n.",
    tag: "{type:'tag', tag} — ținte = toate aeroporturile cu eticheta. {loc} = TAGS[tag].n.",
    company: "{type:'company', pick:'random'|'leader'|'last'} — o companie activă (aleator / cea cu valoarea cea mai mare / cea mai mică). {p} = numele companiei."
  };
  const FX_DOC = {
    demand: "număr: multiplicator al cererii zilnice pe orice rută (ambele sensuri) care are cel puțin un capăt într-un aeroport-țintă. Pentru scope 'global' se aplică tuturor rutelor; pentru 'company' doar rutelor acelei companii. Se înmulțesc între ele dacă sunt mai multe evenimente active.",
    closed: "true: aeroporturile-țintă sunt închise — nu decolează niciun avion DIN ele sau SPRE ele (nici cu pilot, nici cu „Decolează”); îmbarcarea continuă (cozile cresc/se degradează normal); avioanele deja în aer își termină zborul normal.",
    fee: "număr: multiplicator al taxei de aterizare la aeroporturile-țintă.",
    slots: "întreg: capacitatea de sloturi pentru companii la aeroporturile-țintă crește cu atâtea (cu days 0 = permanent). Aeroporturile mici (∞) nu sunt afectate.",
    hold: "true: cât ține evenimentul (câmpul mins = durata în minute de joc), niciun avion nu decolează de la aeroporturile-țintă; aterizările continuă.",
    delay: "minute de joc: se adaugă la timpul minim de îmbarcare/întoarcere (turnaround) al avioanelor aflate la aeroporturile-țintă; pentru pilot, și la pragurile de așteptare.",
    fuel: "număr: multiplicator al indicelui global de preț al combustibilului (scope global).",
    elastic: "număr: multiplicator al elasticității la preț ε din formula atractivității (scope global). >1 = pasagerii sunt mai sensibili la preț.",
    tax: "fracție 0..1: la decontarea de la sfârșitul zilei, fiecare companie vizată plătește această parte din profitul pozitiv al zilei.",
    crew: "număr: multiplicator al salariilor piloților/echipajelor și al costului de echipaj pe zbor.",
    interest: "număr: multiplicator al dobânzii zilnice la creditele bancare (noi și existente) cât timp e activ.",
    breakdown: "număr: multiplicator al șansei de pană (scope company → doar acea companie; global → toți).",
    stars: "întreg ±: modifică temporar reputația (stelele) companiei/companiilor vizate pe durata evenimentului (limitată la 1..5).",
    cash: "€ (poate fi negativ): suma se adaugă o singură dată, la declanșare, fiecărei companii vizate.",
    cashPct: "fracție: o singură dată, fiecare companie vizată primește (sau pierde, dacă e negativ) această parte din banii ei actuali (doar dacă are bani pozitivi).",
    cards: "întreg: o singură dată, fiecare companie vizată primește atâtea cărți de resursă normale aleatoare.",
    maint: "număr: multiplicator al costurilor zilnice de întreținere a avioanelor pentru companiile vizate."
  };
  const FX_KEYS = Object.keys(FX_DOC);
  const EVENTS = [
    { id: "cenusa", n: "Nor de cenușă vulcanică", icon: "🌋", mood: "rau", neg: true, w: 4, days: 1, mins: [960, 1440],
      scope: { type: "region", regs: ["eu-n", "as-se", "sa-n", "na-w", "oc"] }, fx: { closed: true },
      chip: "Cenușă vulcanică · {loc}", ef: "nimic nu zboară spre sau dinspre zonă",
      eff: "Niciun zbor spre sau dinspre zonă; avioanele de acolo stau la sol.",
      fix: "Mută avioanele libere pe rute din afara zonei; altfel trece singur în {t}. 🛡️ Asigurarea (carte specială) îl anulează automat dacă o ai când apare.",
      d: "Un vulcan s-a trezit cu chef de spectacol. Spațiul aerian din {loc} e închis 16–24 de ore: nimic nu decolează spre sau dinspre zonă." },
    { id: "uragan", n: "Uragan", icon: "🌀", mood: "rau", neg: true, w: 4, days: 1, months: [6, 7, 8, 9, 10, 11],
      scope: { type: "region", regs: ["carib", "na-e", "as-e", "as-se"] }, fx: { closed: true, demand: 0.6 },
      chip: "Uragan · {loc}", ef: "aeroporturi închise, cerere −40%",
      eff: "Aeroporturile din zonă sunt închise; cererea în zonă −40%.",
      fix: "Mută avioanele libere pe rute din afara zonei; altfel trece singur în {t}. 🛡️ Asigurarea (carte specială) îl anulează automat dacă o ai când apare.",
      d: "Un uragan mătură {loc}. Aeroporturile sunt închise o zi, iar turiștii stau prin hoteluri cu lumânări." },
    { id: "greva", n: "Grevă la aeroport", icon: "✊", mood: "rau", neg: true, w: 6, days: 1, mins: [360, 720],
      scope: { type: "airport", minSize: 2 }, fx: { hold: true },
      chip: "Grevă la {loc}", ef: "avioanele de acolo nu pot decola",
      eff: "Niciun avion nu decolează de acolo; aterizările continuă, pasagerii așteaptă la poartă.",
      fix: "Nimic de făcut — trece singur în {t}. 🛡️ Asigurarea (carte specială) îl anulează automat dacă o ai când apare.",
      d: "Personalul de la sol din {loc} a ieșit cu pancarte. Cât ține greva (6–12 ore), niciun avion nu decolează de acolo; pasagerii așteaptă la poartă, iar aterizările continuă." },
    { id: "ceata", n: "Ceață densă", icon: "🌫️", mood: "rau", neg: true, w: 6, days: 1, mins: [300, 600],
      scope: { type: "airport", n: 2 }, fx: { hold: true },
      chip: "Ceață la {loc}", ef: "avioanele de acolo nu pot decola",
      eff: "Niciun avion nu decolează de acolo; aterizările continuă.",
      fix: "Nimic de făcut — trece singur în {t}. 🛡️ Asigurarea (carte specială) îl anulează automat dacă o ai când apare.",
      d: "Ceață cât să tai cu cuțitul la {loc}. Între 5 și 10 ore nu decolează nimic de acolo, până se ridică ceața." },
    { id: "controlori", n: "Grevă a controlorilor de trafic", icon: "🎧", mood: "rau", neg: true, w: 3, days: 1, mins: [600, 900],
      scope: { type: "region", regs: ["eu-w", "eu-s", "na-e", "as-e"] }, fx: { delay: 90, demand: 0.9 },
      chip: "Grevă a controlorilor · {loc}", ef: "+1,5 h la fiecare decolare, cerere −10%",
      eff: "Fiecare decolare din zonă întârzie +1,5 h; cererea în zonă −10%.",
      fix: "Nimic de făcut — trece singur în {t}. 🛡️ Asigurarea (carte specială) îl anulează automat dacă o ai când apare.",
      d: "Controlorii de trafic din {loc} lucrează „după regulament” 10–15 ore: fiecare decolare din zonă întârzie o oră și jumătate, iar cererea scade cu 10%." },
    { id: "vacanta", n: "Sezonul vacanțelor", icon: "🏖️", mood: "bun", neg: false, w: 6, days: 7, months: [6, 7, 8, 12],
      scope: { type: "tag", tag: "plajă" }, fx: { demand: 1.5 },
      chip: "Sezonul vacanțelor", ef: "cerere +50% spre destinațiile cu plajă",
      eff: "Cererea spre destinațiile cu plajă +50%.",
      fix: "Profită: mai multe avioane sau preț mai mare pe rutele spre plaje.",
      d: "Toată lumea vrea la plajă! Cererea spre destinațiile cu plajă crește cu 50% o săptămână." },
    { id: "schi", n: "Sezonul de schi", icon: "⛷️", mood: "bun", neg: false, w: 5, days: 7, months: [12, 1, 2, 3, 7],
      scope: { type: "tag", tag: "schi" }, fx: { demand: 1.6 },
      chip: "Sezonul de schi", ef: "cerere +60% spre stațiunile de schi",
      eff: "Cererea spre stațiunile de schi +60%.",
      fix: "Profită: mai multe avioane sau preț mai mare pe rutele spre stațiuni.",
      d: "Zăpadă proaspătă pe pârtii! Cererea spre stațiunile de schi crește cu 60% o săptămână." },
    { id: "cupa", n: "Campionatul Mondial", icon: "⚽", mood: "bun", neg: false, w: 3, days: 5,
      scope: { type: "airport", minSize: 3 }, fx: { demand: 2 },
      chip: "Campionatul Mondial · {loc}", ef: "cerere ×2 spre oraș",
      eff: "Cererea pe rutele spre oraș ×2.",
      fix: "Profită: pune avioane mai mari sau mai multe pe rutele spre oraș.",
      d: "{loc} găzduiește Campionatul Mondial de fotbal! Cererea pe toate rutele spre oraș se dublează 5 zile." },
    { id: "petrol", n: "Criză a petrolului", icon: "🛢️", mood: "rau", neg: true, w: 4, days: 7, crisis: true,
      scope: { type: "global" }, fx: { fuel: 1.4 },
      chip: "Criză a petrolului", ef: "combustibil +40% pentru toți",
      eff: "Combustibilul costă +40% pentru toți; zborurile lungi și avioanele mari suferă cel mai mult.",
      fix: "⛽ Contract de combustibil (carte specială: −30%, 5 zile); investiția Flotă eco (−20% combustibil pe tip).",
      d: "Prețul petrolului a luat-o razna: combustibilul e cu 40% mai scump o săptămână." },
    { id: "petrolIeftin", n: "Petrol ieftin", icon: "💧", mood: "bun", neg: false, w: 4, days: 5,
      scope: { type: "global" }, fx: { fuel: 0.75 },
      chip: "Petrol ieftin", ef: "combustibil −25% pentru toți",
      eff: "Combustibilul costă −25% pentru toți.",
      fix: "Profită: rutele lungi și avioanele mari costă acum mai puțin.",
      d: "Rafinăriile au produs prea mult: combustibilul e cu 25% mai ieftin 5 zile." },
    { id: "recenzie", n: "Recenzie dezastruoasă", icon: "👎", mood: "rau", neg: true, w: 5, days: 3,
      scope: { type: "company", pick: "random" }, fx: { stars: -1 },
      chip: "Recenzie proastă · {p}", ef: "−1 ⭐ reputație",
      eff: "−1 ⭐ reputație: compania e cu ~15% mai puțin aleasă de pasageri față de rivali.",
      fix: "📣 Campanie de reclamă (+1 ⭐, 7 zile); zboruri pline peste 50% (reputația crește încet); Terminal propriu (+0,15 ⭐). 🛡️ Asigurarea (carte specială) îl anulează automat dacă o ai când apare.",
      d: "Un influencer cu milioane de urmăritori s-a plâns de sandvișul de la bordul companiei {p}. −1 ⭐ timp de 3 zile." },
    { id: "premiu", n: "Premiul pentru calitate", icon: "🏆", mood: "bun", neg: false, w: 4, days: 5,
      scope: { type: "company", pick: "last" }, fx: { stars: 1 },
      chip: "Premiu pentru {p}", ef: "+1 ⭐ reputație",
      eff: "+1 ⭐ reputație: compania e cu ~15% mai aleasă de pasageri.",
      fix: "Profită: poți cere prețuri puțin mai mari fără să pierzi pasageri.",
      d: "Juriul internațional a ales {p} drept „Compania anului la zâmbete”. +1 ⭐ timp de 5 zile." },
    { id: "boomTurism", n: "Boom turistic", icon: "🧳", mood: "bun", neg: false, w: 4, days: 7,
      scope: { type: "cont" }, fx: { demand: 1.3 },
      chip: "Boom turistic · {loc}", ef: "cerere +30% pe rutele continentului",
      eff: "Cererea pe rutele care ating continentul +30%.",
      fix: "Profită: mai multe avioane pe rutele de pe continent.",
      d: "Toată lumea vorbește despre {loc}! Cererea pe rutele care ating continentul crește cu 30% o săptămână." },
    { id: "valuta", n: "Monedă avantajoasă", icon: "💱", mood: "bun", neg: false, w: 3, days: 6,
      scope: { type: "cont" }, fx: { demand: 1.2, fee: 0.8 },
      chip: "Monedă ieftină · {loc}", ef: "cerere +20%, taxe de aterizare −20%",
      eff: "Cererea pe continent +20%; taxe de aterizare −20%.",
      fix: "Profită: rute noi sau mai multe zboruri pe continent.",
      d: "Moneda locală din {loc} s-a ieftinit: turiștii năvălesc (+20% cerere), iar taxele de aterizare scad cu 20%." },
    { id: "extindere", n: "Extinderea aeroportului", icon: "🏗️", mood: "bun", neg: false, w: 3, days: 0,
      scope: { type: "airport", minSize: 2 }, fx: { slots: 1 },
      chip: "Terminal nou · {loc}", ef: "+1 slot, definitiv",
      eff: "Aeroportul are definitiv un slot în plus.",
      fix: "Profită: acum e loc pentru încă o companie acolo (🎫 slot).",
      d: "Aeroportul din {loc} a inaugurat un terminal nou: un slot în plus pentru companii, definitiv." },
    { id: "targ", n: "Târg internațional de afaceri", icon: "💼", mood: "bun", neg: false, w: 4, days: 3,
      scope: { type: "airport", tag: "afaceri" }, fx: { demand: 1.8 },
      chip: "Târg de afaceri · {loc}", ef: "cerere +80% spre oraș",
      eff: "Cererea spre oraș +80%.",
      fix: "Profită: mai multe avioane sau preț mai mare pe rutele spre oraș.",
      d: "Mii de oameni de afaceri vin la târgul din {loc}. Cererea spre oraș crește cu 80% trei zile." },
    { id: "festival", n: "Festival de cultură", icon: "🎭", mood: "bun", neg: false, w: 4, days: 4,
      scope: { type: "airport", tag: "cultură" }, fx: { demand: 1.7 },
      chip: "Festival · {loc}", ef: "cerere +70% spre oraș",
      eff: "Cererea spre oraș +70%.",
      fix: "Profită: mai multe avioane sau preț mai mare pe rutele spre oraș.",
      d: "Festival mare la {loc}: muzică, teatru, mâncare bună. Cererea spre oraș crește cu 70% patru zile." },
    { id: "summit", n: "Summit internațional", icon: "🌐", mood: "bun", neg: false, w: 3, days: 3,
      scope: { type: "airport", tag: "capitală" }, fx: { demand: 1.6, fee: 1.3 },
      chip: "Summit · {loc}", ef: "cerere +60%, taxe de aterizare +30%",
      eff: "Cererea spre oraș +60%; taxe de aterizare acolo +30%.",
      fix: "Profită: preț mai mare pe rutele spre oraș acoperă taxele.",
      d: "Șefii lumii se adună la {loc}. Cerere +60%, dar și taxe de aterizare cu 30% mai mari din cauza securității." },
    { id: "carnaval", n: "Carnavalul", icon: "🎉", mood: "bun", neg: false, w: 5, days: 4, months: [2, 3],
      scope: { type: "airport", ids: ["GIG", "SSA", "REC"] }, fx: { demand: 2 },
      chip: "Carnaval · {loc}", ef: "cerere ×2 spre oraș",
      eff: "Cererea spre oraș ×2.",
      fix: "Profită: mai multe avioane sau preț mai mare pe rutele spre oraș.",
      d: "Carnavalul a început la {loc}! Cererea spre oraș se dublează patru zile." },
    { id: "anNou", n: "Anul Nou Lunar", icon: "🧧", mood: "bun", neg: false, w: 5, days: 5, months: [1, 2],
      scope: { type: "region", regs: ["as-e", "as-se"] }, fx: { demand: 1.4 },
      chip: "Anul Nou Lunar · {loc}", ef: "cerere +40% în zonă",
      eff: "Cererea în zonă +40%.",
      fix: "Profită: mai multe avioane pe rutele din zonă.",
      d: "Milioane de oameni pleacă acasă de Anul Nou Lunar: cererea în {loc} crește cu 40%." },
    { id: "pene", n: "Pene în serie", icon: "🔧", mood: "rau", neg: true, w: 4, days: 3,
      scope: { type: "company", pick: "random" }, fx: { breakdown: 2, maint: 1.5 },
      chip: "Pene în serie · {p}", ef: "pene ×2, întreținere +50%",
      eff: "Pene de 2× mai dese și întreținere +50% pentru companie.",
      fix: "🔧 Centru de mentenanță (investiție: −40% pene, −25% întreținere); avioanele noi se strică mai rar. 🛡️ Asigurarea (carte specială) îl anulează automat dacă o ai când apare.",
      d: "Un lot de piese defecte a ajuns în hangarele companiei {p}: pene de două ori mai dese și întreținere mai scumpă 3 zile." },
    { id: "subventie", n: "Subvenție pentru turism", icon: "💶", mood: "bun", neg: false, w: 3, days: 0,
      scope: { type: "company", pick: "last" }, fx: { cash: 1500000 },
      chip: "Subvenție · {p}", ef: "+1,5 M € o singură dată",
      eff: "+1,5 M € în cont, o singură dată.",
      fix: "Nimic de făcut — banii sunt deja în cont.",
      d: "Guvernul vrea mai mulți turiști și îi dă o mână de ajutor companiei {p}: 1,5 M € cadou." },
    { id: "grevaPiloti", n: "Piloții cer mărire", icon: "👨‍✈️", mood: "rau", neg: true, w: 3, days: 3,
      scope: { type: "global" }, fx: { crew: 1.5 },
      chip: "Piloții cer mărire", ef: "salariile echipajelor +50% pentru toți",
      eff: "Salariile piloților și costul echipajelor +50% pentru toți.",
      fix: "Concediază temporar piloții de pe rutele slabe și decolează manual; altfel trece singur în {t}.",
      d: "Sindicatul piloților a negociat dur: salariile echipajelor cresc cu 50% timp de 3 zile." },
    { id: "taxaVerde", n: "Taxa verde", icon: "🌱", mood: "rau", neg: true, w: 3, days: 5, crisis: true, minDay: 5,
      scope: { type: "global" }, fx: { tax: 0.1 },
      chip: "Taxa verde", ef: "10% din profitul zilei merge la stat",
      eff: "10% din profitul pozitiv al zilei merge la stat, pentru toți.",
      fix: "Nimic de făcut — trece singur în {t}.",
      d: "Guvernele lumii introduc o taxă pe emisii: 10% din profitul zilnic merge la stat timp de 5 zile." },
    { id: "dobanzi", n: "Dobânzi în creștere", icon: "🏦", mood: "rau", neg: true, w: 3, days: 6, crisis: true, minDay: 5,
      scope: { type: "global" }, fx: { interest: 1.5 },
      chip: "Dobânzi în creștere", ef: "dobânzi la credite +50%",
      eff: "Dobânda la creditele bancare +50%.",
      fix: "🏦 Rambursează creditele bancare dacă ai bani; evită credite noi acum.",
      d: "Băncile centrale strâng șurubul: dobânzile la credite cresc cu 50% șase zile." },
    { id: "razboiPreturi", n: "Pasageri vânători de oferte", icon: "🏷️", mood: "neutru", neg: false, w: 3, days: 4,
      scope: { type: "global" }, fx: { elastic: 1.35 },
      chip: "Vânători de oferte", ef: "pasagerii aleg mult mai mult după preț",
      eff: "Pasagerii sunt mult mai sensibili la preț (elasticitate ×1,35).",
      fix: "Prețul mic câștigă acum mai mulți pasageri, cel mare pierde mai mulți: ajustează prețurile.",
      d: "Toată lumea compară prețurile pe telefon: pasagerii sunt mult mai sensibili la preț 4 zile. Cine e ieftin câștigă!" },
    { id: "ziuaAviatiei", n: "Ziua Aviației", icon: "🎈", mood: "bun", neg: false, w: 3, days: 0,
      scope: { type: "global" }, fx: { cards: 2 },
      chip: "Ziua Aviației", ef: "2 cărți cadou pentru fiecare",
      eff: "Fiecare companie primește 2 cărți de resursă.",
      fix: "Nimic de făcut — cărțile sunt deja în mână.",
      d: "La mulți ani, aviație! Fiecare companie primește cadou 2 cărți de resursă." },
    { id: "viralBun", n: "Video viral", icon: "📱", mood: "bun", neg: false, w: 3, days: 4,
      scope: { type: "company", pick: "random" }, fx: { demand: 1.25, stars: 1 },
      chip: "Video viral · {p}", ef: "cerere +25%, +1 ⭐",
      eff: "Cererea companiei +25% și +1 ⭐ reputație.",
      fix: "Profită: mai multe zboruri cât ține.",
      d: "Un steward de la {p} a cântat la microfon și a strâns 20 de milioane de vizualizări. Cerere +25% și +1 ⭐ timp de 4 zile." }
  ];

  /* ======================================================================================================
     AVATARE (10: 5 bărbați, 5 femei) — meta pentru ART (portrete bust, expresii neutral/happy/angry/smug).
     ====================================================================================================== */
  const AVATARS = [
    { id: 0, g: "m", name: "Victor", age: 45, skin: "#e8b48f", hair: "#3b2a20", outfit: "#1f2a44", accent: "#d4af37",
      style: "Magnat sigur pe el: costum bleumarin în trei piese, cravată aurie, păr dat pe spate cu tâmple grizonate, barbă scurtă îngrijită, ceas de aur. Zâmbet de vânzător de avioane." },
    { id: 1, g: "m", name: "Andrei", age: 29, skin: "#f1c6a5", hair: "#8a5a2b", outfit: "#2c4a7a", accent: "#ffd447",
      style: "Fost pilot devenit antreprenor: cămașă albă cu epoleți, ochelari de aviator ridicați pe frunte, păr castaniu ciufulit, gropițe în obraji." },
    { id: 2, g: "m", name: "Kwame", age: 38, skin: "#7a4a2e", hair: "#1a1410", outfit: "#5b2a86", accent: "#22e0d0",
      style: "Elegant și carismatic: sacou violet cu revere de catifea, papion turcoaz, păr scurt cu linie laterală, barbă fină, zâmbet larg." },
    { id: 3, g: "m", name: "Hiro", age: 34, skin: "#f0d0a8", hair: "#121212", outfit: "#26313d", accent: "#ff5ca8",
      style: "Tehnocrat minimalist: helancă neagră, sacou gri antracit, ochelari rotunzi subțiri, păr negru tuns modern cu breton lateral, aer calm de strateg." },
    { id: 4, g: "m", name: "Matei", age: 52, skin: "#d9a37f", hair: "#c9c9c9", outfit: "#6b3a1f", accent: "#9be14a",
      style: "Moșier jovial: sacou de tweed maro, vestă, mustață albă stufoasă, sprâncene expresive, obraji rumeni — râde cu toată fața." },
    { id: 5, g: "f", name: "Ioana", age: 31, skin: "#f3c9a8", hair: "#5a2e1a", outfit: "#b0263c", accent: "#ffd447",
      style: "Directoare energică: blazer roșu-vișiniu, cercei mici aurii, păr șaten-roșcat prins în coc lejer cu șuvițe libere, privire hotărâtă." },
    { id: 6, g: "f", name: "Elena", age: 47, skin: "#e9bd9a", hair: "#1e1e24", outfit: "#1b2b3a", accent: "#22e0d0",
      style: "Bancheră rafinată: costum bleumarin închis, colier de perle, bob negru lucios tăiat drept, ruj discret, o sprânceană ridicată, cu aer de superioritate." },
    { id: 7, g: "f", name: "Amara", age: 27, skin: "#6b3f26", hair: "#14100c", outfit: "#e2702b", accent: "#ffffff",
      style: "Fondatoare de startup: geacă bomber portocalie peste tricou alb, păr afro voluminos cu bandană, cercei-cerc mari, zâmbet contagios." },
    { id: 8, g: "f", name: "Mei", age: 36, skin: "#f2d4b5", hair: "#0f0f12", outfit: "#2f6f5e", accent: "#ff8c32",
      style: "Strategă elegantă: rochie-sacou verde smarald, păr negru lung și drept cu breton, ochelari cu ramă subțire, agrafă argintie." },
    { id: 9, g: "f", name: "Sofia", age: 58, skin: "#e4b28c", hair: "#d8d8d8", outfit: "#4b2c5e", accent: "#b48cff",
      style: "Matriarha aviației: pardesiu prună, eșarfă de mătase cu model de avioane, păr argintiu tuns scurt și coafat, ochelari pe lănțișor, aer de bunică ce te bate la negocieri." }
  ];

  /* ======================================================================================================
     CULORI (6) — alese să se vadă bine pe un ocean bleumarin închis (#0b1b33 … #10284a), între ele distincte.
     hex = culoarea principală (linii, avioane); light = halou/text pe fundal închis; dark = contur/umbră.
     ====================================================================================================== */
  const COLORS = [
    { id: 0, n: "Portocaliu", hex: "#ff6a2a", light: "#ffb08a", dark: "#a3340a" },
    { id: 1, n: "Turcoaz", hex: "#22e0d0", light: "#9cf5ec", dark: "#0b7f76" },
    { id: 2, n: "Roz", hex: "#ff5ca8", light: "#ffb0d4", dark: "#a3195c" },
    { id: 3, n: "Verde lime", hex: "#9be14a", light: "#d2f5a8", dark: "#4f7d17" },
    { id: 4, n: "Galben", hex: "#ffd447", light: "#ffeaa3", dark: "#9c7a00" },
    { id: 5, n: "Violet", hex: "#b48cff", light: "#ddc9ff", dark: "#5b37a8" }
  ];

  /* ======================================================================================================
     STATISTICI (LOGIC le ține per jucător în st.pl[seat].stats sau similar) + REALIZĂRI
     cond: {stat, gte} | {stat, lte} | {len: stat, gte} (lungimea unei liste) | {ctx: câmp, gte|lte|eq} | {all:[...]} | {any:[...]}
     ctx (la final): {rank (1 = primul), players (nr. companii), won (bool), survived (bool), value (€ valoarea finală),
                      dur (minute; 0 = fără timp)}
     ====================================================================================================== */
  const STATS_FIELDS = {
    flights: "zboruri efectuate (decolări cu ≥1 pasager)",
    pax: "pasageri transportați în total",
    revenue: "€ încasați din bilete în total",
    profit: "€ profit operațional cumulat din zboruri (venit − costuri pe zbor)",
    bestFlight: "€ cel mai mare profit dintr-un singur zbor",
    fullFlights: "zboruri decolate cu 100% locuri ocupate",
    emptyFlights: "zboruri decolate cu < 20% locuri ocupate",
    manualDeparts: "decolări făcute cu butonul „Decolează” (fără pilot)",
    routes: "rute construite în total (inclusiv primite prin negociere)",
    routesMax: "numărul maxim de rute operate simultan",
    pioneer: "rute construite cu bonus de pionier (primul pe acea pereche)",
    longestRoute: "km — cea mai lungă rută construită",
    conts: "listă de coduri de continent atinse de rutele tale (ex. [\"EU\",\"AS\"])",
    airports: "listă de coduri IATA în care ai prezență (cumulativ)",
    hubs: "huburi cumpărate",
    slots: "sloturi cumpărate",
    planesBought: "avioane noi cumpărate",
    usedBought: "avioane folosite cumpărate",
    leased: "avioane luate în leasing",
    planesSold: "avioane vândute",
    planesMax: "numărul maxim de avioane deținute simultan",
    s350: "Skyliner 350 deținute simultan (maxim)",
    pilotsMax: "numărul maxim de piloți angajați simultan",
    maxCash: "€ — maximul de bani deținuți la un moment dat",
    maxValue: "€ — maximul valorii companiei",
    daysNegative: "zile încheiate cu bani negativi",
    bankLoans: "credite bancare luate",
    bankBorrowed: "€ împrumutați de la bancă în total",
    loansGiven: "împrumuturi acordate altor jucători (acceptate)",
    loansTaken: "împrumuturi primite de la alți jucători",
    deals: "negocieri încheiate cu acord",
    pacts: "pacte de neagresiune semnate",
    freezes: "cărți ❄️ Îngheață timpul jucate cu succes",
    frozen: "de câte ori ai fost înghețat (efectiv)",
    breakers: "cărți 🔥 folosite cu succes",
    specials: "cărți speciale jucate (orice tip)",
    specialsDrafted: "cărți speciale luate la draft",
    picks: "cărți luate la draft",
    cardsBuilt: "cărți de resursă consumate la construcții",
    ghiseu: "schimburi la Ghișeu",
    cardsBought: "cărți cumpărate cu bani",
    sharesBought: "acțiuni ale altor companii cumpărate (bucăți, total)",
    breakdowns: "pene suferite",
    insured: "evenimente negative anulate cu 🧯",
    consultantTips: "sfaturi primite de la consultant",
    rankFirstDays: "zile încheiate pe primul loc"
  };
  function newStats() {
    const s = {};
    Object.keys(STATS_FIELDS).forEach(k => { s[k] = (k === "conts" || k === "airports") ? [] : 0; });
    return s;
  }
  const ACH = [
    { id: "primulZbor", n: "Primul zbor", icon: "🛫", d: "Fă primul zbor cu pasageri.", cond: { stat: "flights", gte: 1 } },
    { id: "navetist", n: "Navetist convins", icon: "🔁", d: "Efectuează 100 de zboruri.", cond: { stat: "flights", gte: 100 } },
    { id: "suteDeMii", n: "O sută de mii de suflete", icon: "👥", d: "Transportă 100.000 de pasageri.", cond: { stat: "pax", gte: 100000 } },
    { id: "plin", n: "Casa închisă", icon: "🎟️", d: "Decolează de 20 de ori cu avionul plin ochi.", cond: { stat: "fullFlights", gte: 20 } },
    { id: "lovitura", n: "Lovitura zilei", icon: "💰", d: "Obține cel puțin 500.000 € profit dintr-un singur zbor.", cond: { stat: "bestFlight", gte: 500000 } },
    { id: "imperiu", n: "Imperiu aerian", icon: "🗺️", d: "Operează 10 rute în același timp.", cond: { stat: "routesMax", gte: 10 } },
    { id: "pionier", n: "Pionierul cerului", icon: "🧭", d: "Deschide 3 rute în premieră (bonus de pionier).", cond: { stat: "pioneer", gte: 3 } },
    { id: "intercontinental", n: "Peste ocean", icon: "🌊", d: "Construiește o rută de peste 8.000 km.", cond: { stat: "longestRoute", gte: 8000 } },
    { id: "globetrotter", n: "Pe toate continentele", icon: "🌍", d: "Atinge cu rutele tale toate cele 6 continente.", cond: { len: "conts", gte: 6 } },
    { id: "colectionar", n: "Colecționar de aeroporturi", icon: "📍", d: "Fii prezent în 20 de aeroporturi.", cond: { len: "airports", gte: 20 } },
    { id: "flota", n: "Amiralul flotei", icon: "✈️", d: "Deține 12 avioane în același timp.", cond: { stat: "planesMax", gte: 12 } },
    { id: "giganti", n: "Familia de giganți", icon: "🐋", d: "Deține 3 Skyliner 350 în același timp.", cond: { stat: "s350", gte: 3 } },
    { id: "chilipir", n: "Vânător de chilipiruri", icon: "🏷️", d: "Cumpără 3 avioane folosite.", cond: { stat: "usedBought", gte: 3 } },
    { id: "autopilot", n: "Pilot automat", icon: "👨‍✈️", d: "Ai 8 piloți angajați în același timp.", cond: { stat: "pilotsMax", gte: 8 } },
    { id: "hub", n: "Stăpânul nodurilor", icon: "🔁", d: "Cumpără 2 huburi.", cond: { stat: "hubs", gte: 2 } },
    { id: "bogat", n: "Sac de bani", icon: "🏦", d: "Ai la un moment dat 50 M € în cont.", cond: { stat: "maxCash", gte: 50000000 } },
    { id: "faraDatorii",n: "Fără datorii", icon: "🕊️", d: "Termină partida fără să fi luat vreun credit bancar.", cond: { all: [{ stat: "bankLoans", lte: 0 }, { ctx: "survived", eq: true }] } },
    { id: "phoenix", n: "Pasărea Phoenix", icon: "🔥", d: "Treci prin cel puțin 2 zile pe minus și câștigă partida.", cond: { all: [{ stat: "daysNegative", gte: 2 }, { ctx: "won", eq: true }] } },
    { id: "diplomat", n: "Diplomat", icon: "🤝", d: "Încheie 3 negocieri cu acord.", cond: { stat: "deals", gte: 3 } },
    { id: "pacifist", n: "Porumbelul păcii", icon: "🕊️", d: "Semnează 2 pacte de neagresiune.", cond: { stat: "pacts", gte: 2 } },
    { id: "bancherul", n: "Bancherul", icon: "💼", d: "Acordă un împrumut altui jucător.", cond: { stat: "loansGiven", gte: 1 } },
    { id: "eraGlaciara", n: "Era glaciară", icon: "❄️", d: "Îngheață adversarii de 3 ori.", cond: { stat: "freezes", gte: 3 } },
    { id: "dezghet", n: "Dezgheț", icon: "🔥", d: "Sparge un îngheț cu Spărgătorul de gheață.", cond: { stat: "breakers", gte: 1 } },
    { id: "trefla", n: "Mâna norocoasă", icon: "🃏", d: "Ia 3 cărți speciale la draft într-o partidă.", cond: { stat: "specialsDrafted", gte: 3 } },
    { id: "jucatorCarti", n: "Jucător de cărți", icon: "🎴", d: "Joacă 6 cărți speciale.", cond: { stat: "specials", gte: 6 } },
    { id: "investitor", n: "Investitor la bursă", icon: "📈", d: "Cumpără 20 de acțiuni ale altor companii.", cond: { stat: "sharesBought", gte: 20 } },
    { id: "asigurat", n: "Prudent", icon: "🧯", d: "Anulează un eveniment negativ cu Asigurarea.", cond: { stat: "insured", gte: 1 } },
    { id: "lider", n: "Lider de neclintit", icon: "👑", d: "Încheie 10 zile pe primul loc.", cond: { stat: "rankFirstDays", gte: 10 } },
    { id: "campion", n: "Regele cerului", icon: "🏆", d: "Câștigă o partidă.", cond: { ctx: "won", eq: true } },
    { id: "supravietuitor", n: "Supraviețuitor", icon: "🛟", d: "Termină o partidă de 3–4 companii fără faliment.", cond: { all: [{ ctx: "players", gte: 3 }, { ctx: "survived", eq: true }] } },
    { id: "suta", n: "Clubul celor 100", icon: "💎", d: "Termină cu o valoare a companiei de cel puțin 100 M €.", cond: { ctx: "value", gte: 100000000 } },
    { id: "manual", n: "Mână de fier", icon: "🕹️", d: "Apasă „Decolează” de 50 de ori.", cond: { stat: "manualDeparts", gte: 50 } }
  ];
  function _condOk(c, stats, ctx) {
    if (!c) return false;
    if (c.all) return c.all.every(x => _condOk(x, stats, ctx));
    if (c.any) return c.any.some(x => _condOk(x, stats, ctx));
    let v;
    if (c.len) v = Array.isArray(stats[c.len]) ? stats[c.len].length : 0;
    else if (c.ctx) v = ctx ? ctx[c.ctx] : undefined;
    else v = stats[c.stat];
    if (c.eq !== undefined) return v === c.eq;
    if (v == null) v = 0;
    if (c.gte !== undefined && !(v >= c.gte)) return false;
    if (c.lte !== undefined && !(v <= c.lte)) return false;
    return true;
  }
  /** checkAch(stats, ctx?) → lista id-urilor realizărilor îndeplinite. Fără ctx, cele care depind de ctx nu se acordă. */
  function checkAch(stats, ctx) { stats = stats || {}; return ACH.filter(a => _condOk(a.cond, stats, ctx)).map(a => a.id); }

  /* ======================================================================================================
     REPLICI (LINES) — sintaxă: {p} numele jucătorului (subiectul), {o} celălalt jucător, {c} compania lui {p}, {oc} compania
     lui {o}, {a} sumă (număr → fmtEur), {x}/{y} aeroporturi (cod IATA → nume), {t} tip avion (id → nume), {n} număr,
     {card} carte (id → icon + nume) sau text liber, {r} rută „X – Y”; [masc|fem] se acordă cu vars.g (genul lui {p}),
     <masc|fem> cu vars.og (genul lui {o}). Numele apar doar la nominativ/acuzativ (niciodată „lui {p}”), deci merge orice nume.
     LINE_VARS spune ce variabile folosește fiecare cheie.
     ====================================================================================================== */
  const LINE_VARS = {
    depart: "p g t x y n(pasageri)", departEmpty: "p g t x y n(pasageri)", fullPlane: "p g t x y n c",
    arriveProfit: "p g x y n a(profit)", arriveLoss: "p g x y a(pierdere, pozitiv)",
    build: "p g x y c", buildPioneer: "p g x y c", buyPlane: "p g t c", buyUsed: "p g t", lease: "p g t",
    sellPlane: "p g t a", hub: "p g x c", slot: "p g x c", pilotHire: "p g t c", breakdown: "p g t x c",
    bankrupt: "p g c", freeze: "p g o og (p = cel care îngheață, o = victima)", frozen: "p g o og (p = victima, o = atacatorul; adresat victimei)",
    breaker: "p g o og (p = cel care sparge gheața, o = atacatorul)",
    draftPick: "p g card", draftSpecial: "p g card", draftWhisper: "p g card n(poziția cărții, 1..)", draftMissed: "card (lista cărților rămase, text)",
    draftTurn: "p g (adresat celui la rând)",
    negoOpen: "p g o og (p deschide, o invitatul)", negoPhrases: "p g o og (p = cel care vorbește, persoana I)",
    negoAccept: "p g o og (p acceptă oferta lui o)", negoRefuse: "p g o og (p refuză)", negoCounter: "p g o og (p face contraoferta)",
    loanAsk: "p g o og a (p cere de la o)", loanRepaid: "p g o og oc a (p a returnat lui o)", loanCollect: "p g o og c a (o își încasează forțat de la p)",
    pact: "p g o og n(zile)", bankLoan: "p g a n(zile)", cashLow: "p g n(zile rămase)",
    consultantIntro: "p g (adresat clientului)", consultantFire: "p g (adresat clientului)",
    special: "p g card", eventIntro: "d (textul evenimentului)", dayStart: "n(ziua)", leader: "p g c", sharesBuy: "p g o og n(acțiuni) oc",
    gameEnd: "p g c a(valoare)", invest: "p g c (investiție: extinde baza / terminal / flotă eco / mentenanță — tipul nu e în text)"
  };
  const LINES = {
    depart: [
      "{p} decolează din {x} spre {y} cu {n} pasageri. Centurile, vă rog!",
      "Roțile s-au desprins de pistă la {x}. {p} trimite {n} pasageri spre {y}.",
      "{n} pasageri, un {t} și multă speranță: zborul {x} – {y} a plecat. {p} își freacă mâinile.",
      "Turnul de control din {x}: „Drum bun!” {p} pleacă spre {y}.",
      "{p} a apăsat „Decolează” cu atâta convingere, că s-a auzit până la {y}.",
      "Zbor {x} → {y}: {n} locuri ocupate, un steward zâmbitor și un pilot care fluieră. Bravo, {p}!",
      "{p} a trimis {n} oameni la {y}. Să nu uite nimeni să ia magneți de frigider.",
      "Motoarele torc ca o pisică mulțumită: {p} decolează din {x} cu {n} suflete la bord.",
      "Cafeaua e caldă, bagajele sunt la bord, {y} ne așteaptă. Zbor fericit, {p}!",
      "{p} a decolat spre {y}. Pasagerii aplaudă deja, deși încă n-au aterizat.",
      "Din {x} spre {y}, cu {n} pasageri și un singur bebeluș care plânge. Curaj, {p}!",
      "{p} e [mândru|mândră]: încă un {t} în aer, direcția {y}.",
      "Atenție, cer: {p} vine cu un {t} plin de turiști dinspre {x}.",
      "Încă un zbor, încă o felie de cer. {p} pleacă spre {y} cu {n} pasageri."
    ],
    departEmpty: [
      "{p} a decolat spre {y} cu doar {n} pasageri. Fiecare are un rând întreg pentru el.",
      "Zbor aproape gol {x} – {y}. Însoțitorii de bord se plictisesc deja. Hai, {p}, umple-l data viitoare!",
      "{n} pasageri pe un avion întreg? {p} e [generos|generoasă] cu spațiul pentru picioare.",
      "Ecou în cabină pe ruta {x} – {y}. {p} plătește combustibil pentru aer.",
      "{p} a decolat pe jumătate gol. Sau pe trei sferturi. Nu ne uităm.",
      "Pasagerii de pe zborul spre {y} au primit fiecare câte trei pernuțe. {p} a fost [darnic|darnică].",
      "Avionul spre {y} pleacă aerisit: {n} oameni și multe scaune libere. {p}, poate un preț mai mic?",
      "Zbor VIP fără să vrea: {n} pasageri, iar {p} plătește tot kerosenul.",
      "{p} a trimis spre {y} un avion care sună a sală de lectură: liniște și locuri goale.",
      "Contabilul suspină: {p} zboară spre {y} cu {n} pasageri.",
      "Cabina e atât de goală încât pasagerii pot juca fotbal. Spor, {p}!",
      "Un zbor romantic: {p}, {n} pasageri și o mulțime de hublouri libere."
    ],
    fullPlane: [
      "Plin ochi! {t}-ul companiei {c} spre {y} nu mai are niciun loc liber.",
      "Sold out! {p} decolează din {x} cu toate cele {n} locuri ocupate.",
      "Niciun ac nu mai încape: zborul {x} – {y} e complet. Bravo, {p}!",
      "{p} a umplut avionul până la ultimul scaun. Bagajele de mână se roagă să încapă.",
      "Casă închisă la {x}! {p} pleacă spre {y} cu avionul plin.",
      "{n} din {n}! {p} e [regele|regina] îmbarcării.",
      "Coadă la poartă, avion plin, pilot fericit. {p} decolează spre {y}.",
      "Toate locurile vândute! {p} se gândește deja la un avion mai mare.",
      "Zborul spre {y} e plin ca un autobuz la ora 8. {p} zâmbește.",
      "„Ne pare rău, nu mai avem locuri”, anunță poarta de la {x}. {p} e [încântat|încântată].",
      "{p} a vândut tot. Absolut tot. Până și locul de lângă toaletă.",
      "Avion plin spre {y}! Contabilul [lui|ei] a început să danseze."
    ],
    arriveProfit: [
      "{p} a aterizat la {y} și a încasat {a}. Ka-ching!",
      "Aterizare lină la {y}. Pasagerii aplaudă, iar {p} numără: +{a}.",
      "Zborul din {x} a ajuns cu bine. Profit curat pentru {p}: {a}.",
      "{p} zâmbește larg: încă {a} în cont după cursa {x} – {y}.",
      "Roțile au atins pista la {y}, banii au atins contul: +{a} pentru {p}.",
      "Bravo, {p}! {n} pasageri fericiți și {a} profit.",
      "Calculatorul de bord arată verde: {p} câștigă {a} pe ruta {x} – {y}.",
      "{p} a adus {n} turiști la {y}. Și {a} acasă.",
      "Avionul a aterizat, iar {p} e mai [bogat|bogată] cu {a}.",
      "Încă o cursă reușită! {p} adaugă {a} la pușculiță.",
      "Pasagerii au coborât, banii au urcat: {p} +{a}.",
      "Aterizare de manual la {y}. {p} pune deoparte {a}.",
      "Profitul aterizează și el: {a} pentru {p}. Ce zi frumoasă!"
    ],
    arriveLoss: [
      "{p} a aterizat la {y} cu o pierdere de {a}. Măcar priveliștea a fost gratis.",
      "Cursa {x} – {y} a costat mai mult decât a adus: −{a}. {p} se scarpină în cap.",
      "Pasagerii sunt fericiți, contabilul nu: {p} pierde {a}.",
      "{p} a transportat aer scump: −{a} pe ruta {x} – {y}.",
      "Aterizare reușită, bilanț ratat: −{a}. Hai, {p}, ajustează prețul!",
      "Kerosenul a câștigat runda asta. {p} pierde {a}.",
      "{p} a fost prea [generos|generoasă] cu prețurile: −{a} la {y}.",
      "Zborul spre {y} a fost scurt, dar pierderea e lungă: {a}. Curaj, {p}!",
      "Contul companiei a simțit turbulențe: −{a}. {p} promite că data viitoare iese mai bine.",
      "Bilanț pe roșu după {x} – {y}: −{a}. {p} privește lung foaia de calcul.",
      "{p} a aterizat. Banii, mai puțin: −{a}.",
      "Cursa asta a fost de imagine, nu de profit. {p} pierde {a}."
    ],
    build: [
      "{p} a deschis ruta {x} – {y}! Panglica e tăiată, șampania curge.",
      "Ruta nouă {x} – {y} e gata. {p} e [mândru|mândră] ca un părinte la serbare.",
      "Pe hartă a apărut o linie nouă: {x} – {y}. Semnează {p}.",
      "Anunț important: {p} zboară de azi între {x} și {y}!",
      "Gata cu vorba: {p} a construit ruta {x} – {y}.",
      "{p} a pus încă o cărămidă în imperiu: ruta {x} – {y}.",
      "Cartografii plâng: trebuie să redeseneze harta după ce {p} a deschis {x} – {y}.",
      "Hârtiile sunt ștampilate, echipajele angajate: {x} – {y} e oficial o rută marca {c}.",
      "Ruta {x} – {y} e deschisă. {p}, ai grijă să nu te ia valul!",
      "{p} leagă {x} de {y}. Pasagerii fac deja coadă.",
      "Încă o rută, încă un vis: {p} zboară acum {x} – {y}.",
      "Ultima oră: {p} a construit {x} – {y} și nimeni n-a mai putut [să-l oprească|s-o oprească].",
      "Concurenții se uită cu invidie: {p} a deschis {x} – {y}."
    ],
    buildPioneer: [
      "{p} e [primul|prima] care leagă {x} de {y}! Bonus de pionier și aplauze.",
      "Pionierat! Nimeni n-a mai zburat {x} – {y} până la {p}.",
      "{p} a deschis drumul aerian {x} – {y}. Istoria va ține minte.",
      "Ca un explorator modern, {p} cucerește ruta {x} – {y}. Bonus de pionier!",
      "Prima rută {x} – {y} din lume poartă culorile companiei {c}. Felicitări, {p}!",
      "Nimeni n-a avut curaj, {p} a avut: {x} – {y} e [a lui|a ei]!",
      "Pasagerii din {x} visau la {y} de ani de zile. {p} le-a îndeplinit visul.",
      "{p} a pus steagul pe ruta {x} – {y}. Pionierii primesc cerere mai mare!",
      "Columb ar fi invidios: {p} deschide în premieră {x} – {y}.",
      "Ruta {x} – {y} n-a existat până azi. Mulțumim, {p}!",
      "{p} a descoperit o rută nouă, ca un Magellan cu buget: {x} – {y}.",
      "Premieră mondială: {x} – {y}, operată de {c}. {p} e în al nouălea cer."
    ],
    buyPlane: [
      "{p} și-a cumpărat un {t} nou-nouț. Miroase a plastic și a ambiție.",
      "Flota companiei {c} crește: un {t} nou-nouț intră în hangar.",
      "{p} a plătit cash pentru un {t}. Vânzătorul încă numără.",
      "{p} a botezat deja noul {t}. Numele e secret.",
      "{p} a cumpărat un {t}. Mecanicii fac poze cu el.",
      "Un {t} cu scaunele încă învelite în folie. Proprietar fericit: {p}.",
      "{p} a intrat la dealer după un catalog și a ieșit cu un {t}.",
      "Flota crește! {p} pune în serviciu un {t} nou.",
      "Zgomot de motoare noi: {p} a adus acasă un {t}.",
      "{p} a semnat, a plătit, a zâmbit: {t} livrat!",
      "Pentru cine se tot întreba: da, {p} și-a mai luat un {t}.",
      "{p} e [îndrăgostit|îndrăgostită] de noul {t}. Îl lustruiește personal.",
      "Pista strălucește: un {t} nou la {c}. Felicitări, {p}!"
    ],
    buyUsed: [
      "{p} a luat un {t} la mâna a doua. Are doar câteva zgârieturi… și o poveste.",
      "Chilipir! {p} a cumpărat un {t} folosit. Fostul proprietar plângea de fericire.",
      "Un {t} cu experiență se alătură flotei. {p} speră să nu tușească la decolare.",
      "{p} a descoperit un {t} la mâna a doua. În buzunarul scaunului 14C: o bomboană din 2009.",
      "„Merge ca nou”, a zis vânzătorul. {p} l-a crezut.",
      "{p} a economisit la avion: {t} folosit, preț mic, mecanic pregătit.",
      "Avion cu vechime, dar cu suflet: {p} cumpără un {t} uzat.",
      "{p} a cumpărat un {t} care a mai văzut lumea. Mult.",
      "Pe bord scrie „Nu trântiți ușa”. {p} și-a luat un {t} folosit.",
      "{p} e [un negustor priceput|o negustoreasă pricepută]: {t} folosit, la preț de nimic.",
      "Un {t} cu multe ore de zbor la activ. {p} e [mulțumit|mulțumită].",
      "{p} a adoptat un {t} vârstnic. Promite că-l îngrijește."
    ],
    lease: [
      "{p} a luat în leasing un {t}. Avion azi, plăți mâine.",
      "Fără bani jos: {p} închiriază un {t}.",
      "{p} zboară acum cu un {t} în leasing. Banca zâmbește discret.",
      "Un {t} închiriat intră pe pistă. {p} îl tratează ca pe al său.",
      "Leasing semnat! {p} plătește zilnic pentru un {t}.",
      "{p} a ales leasingul: {t} acum, grijile mai târziu.",
      "Avion cu chirie: {p} primește cheile unui {t}.",
      "{p} preferă să închirieze. Un {t} e gata de zbor.",
      "Contract de leasing pentru un {t}. {p} citește literele mici… sau nu.",
      "{p} a luat un {t} cu abonament. Ca la sală, dar cu aripi.",
      "Un {t} de la finanțator: {p} îl pune imediat la treabă.",
      "{p} închiriază un {t}. Vorba aia: nu-i al tău, dar zboară."
    ],
    sellPlane: [
      "{p} a vândut un {t} pentru {a}. A plâns puțin la despărțire.",
      "Adio, {t}! {p} încasează {a}.",
      "{p} face curat în hangar: {t} vândut cu {a}.",
      "Un {t} pleacă spre alt stăpân. {p} primește {a}.",
      "{p} a vândut un {t}. Noul proprietar a cerut și pernuțele.",
      "Vânzare reușită: {a} pentru {p}, un avion mai puțin în flotă.",
      "{p} a dat un {t} pe {a}. Afacerea e afacere.",
      "Lacrimi pe pistă: {p} își ia rămas-bun de la un {t}. Măcar a luat {a}.",
      "{p} a hotărât: {t}-ul pleacă. În cont intră {a}.",
      "Un {t} scos la vânzare și vândut pe loc. {p} +{a}.",
      "Flota slăbește, contul se îngrașă: {p} vinde un {t} cu {a}.",
      "{p} a vândut un {t}. Mecanicii își șterg o lacrimă."
    ],
    hub: [
      "{p} și-a făcut hub la {x}. De aici pleacă imperiul.",
      "{x} devine a doua casă pentru {p}: hub nou!",
      "Hub deschis la {x}! {p} are acum terminal cu numele pe ușă.",
      "{p} a cumpărat hub la {x}. Taxele scad, ambițiile cresc.",
      "Steagul companiei {c} flutură peste {x}. Hub nou pentru {p}!",
      "{p} face din {x} un nod aerian. Pasagerii în tranzit se bucură.",
      "Panouri noi la {x}: „Bine ați venit la hubul {c}”.",
      "{p} a investit serios: hub la {x}.",
      "Hubul de la {x} e gata. {p} a devenit [stăpânul|stăpâna] aeroportului.",
      "{p} a mutat birourile la {x}. Cafeaua de acolo e mai bună.",
      "Hub nou, eră nouă: {p} la {x}.",
      "Concurenții de la {x} se uită chiorâș: {p} și-a deschis hub."
    ],
    slot: [
      "{p} a cumpărat un slot la {x}. Poarta e rezervată.",
      "Un loc nou pe tabla de plecări din {x}: {c}.",
      "{p} și-a făcut loc la {x}. Ceilalți să se înghesuie.",
      "Slot obținut la {x}! {p} are acum poartă proprie.",
      "{x} are un chiriaș nou: compania {c}.",
      "{p} a pus piciorul la {x}. Slot cumpărat!",
      "Aeroportul din {x} a dat un slot companiei {c}. Felicitări, {p}!",
      "Spațiu la {x}? Nu mai e mult. {p} a luat o bucată.",
      "{p} a rezervat un colț de pistă la {x}.",
      "Noul ghișeu {c} de la {x} miroase a vopsea proaspătă.",
      "{p} intră la {x}. Locurile se împuținează!",
      "Slot nou la {x}. {p} e [pregătit|pregătită] de decolare."
    ],
    pilotHire: [
      "{p} a angajat un pilot pentru {t}. De acum avionul pleacă singur la timp.",
      "Un pilot cu mustață de film preia {t}-ul. {p} se poate relaxa.",
      "{p} are pilot nou! Butonul „Decolează” își ia o pauză.",
      "Pilot angajat. {p} poate dormi [liniștit|liniștită].",
      "„Lasă pe mine, [șefu'|șefa]!” Noul pilot preia {t}-ul companiei {c}.",
      "{p} a dat cheile {t}-ului unui pilot cu experiență.",
      "Un {t} pe pilot automat… pardon, pe pilot uman. Mulțumim, {p}!",
      "{p} a angajat un pilot care știe exact când merită să decoleze.",
      "Pilotul nou al companiei {c} a venit cu ochelari de soare și cafea.",
      "{p} deleagă: {t}-ul are acum pilot propriu.",
      "Ore de zbor, zero griji: {p} a angajat un pilot.",
      "Bun venit la bord, căpitane! {p} ți-a încredințat un {t}."
    ],
    breakdown: [
      "Pană la un {t} al companiei {c}, la {x}. Mecanicii își suflecă mânecile.",
      "Un {t} tușește la {x}. {p} cheamă mecanicul. Întârziere!",
      "Ups! Un șurub rebel ține la sol un {t} la {x}. {p} oftează.",
      "Motorul a făcut „pfff”. {p} are un {t} în reparații la {x}.",
      "Întârziere la {x}: {t}-ul companiei {c} are nevoie de un pic de ulei și multă dragoste.",
      "Pasagerii de la {x} așteaptă cu cafeaua în mână: {t}-ul companiei {c} e în service.",
      "Mecanicul de la {x} zice că „e o nimica toată”. {p} speră să fie adevărat.",
      "Un {t} al companiei {c} a refuzat să pornească la {x}. Are și el zilele lui.",
      "Pană tehnică pentru {p} la {x}. Reputația ia o mică zgârietură.",
      "Un {t} vechi și obosit stă la {x}. {p}, poate e vremea unui avion nou?",
      "Bandă adezivă, rugăciuni inginerești și un {t} în reparații la {x}. Curaj, {p}!",
      "La {x}, un {t} al companiei {c} cere concediu medical."
    ],
    bankrupt: [
      "{p} a dat faliment. Avioanele au fost sechestrate, visul nu.",
      "Cortina cade pentru {c}. {p} iese din joc cu capul sus.",
      "{p} a rămas fără bani și fără aripi. Faliment!",
      "Banca a venit după avioane. {p} părăsește cerul.",
      "Faliment! {p} va scrie o carte: „Cum să pierzi o companie aeriană”.",
      "Ultimul zbor al companiei {c} s-a încheiat. Odihnă plăcută, {p}.",
      "{p} e [falit|falită]. Măcar a zburat frumos.",
      "Executorii au confiscat flota. {p} pleacă acasă cu trenul.",
      "Gata: {c} a intrat în faliment. {p} ne va lipsi de pe cer.",
      "{p} a încercat, a riscat, a pierdut. Faliment cu stil.",
      "Contabilul a stins lumina și a închis ușa. {p} iese din cursă.",
      "Faliment pentru {p}! Restul jucătorilor își împart cerul."
    ],
    freeze: [
      "❄️ {p} <l-a pus|a pus-o> pe {o} pe gheață! Totul stă pe loc.",
      "Brrr! {o} a fost <înghețat|înghețată> de {p}.",
      "{p} a scos cartea de gheață. {o} rămâne <țeapăn|țeapănă> ca un țurțure.",
      "Iarnă bruscă pentru {o}! Semnat: {p}.",
      "{p} a deschis frigiderul, iar {o} a rămas <blocat|blocată> înăuntru.",
      "{o} stă cu flota în frigider, grație unui gest „prietenesc” venit de la {p}.",
      "❄️ Îngheț! {o} nu mai poate mișca nimic. {p} zâmbește [satisfăcut|satisfăcută].",
      "Pinguinii au fost anunțați: {o} e <înghețat|înghețată>, iar {p} culege pasagerii.",
      "{p} a trimis un val de frig. {o} tremură, pasagerii se mută la {p}.",
      "Ger polar! {p} <l-a congelat|a congelat-o> pe {o} pentru câteva clipe.",
      "{o}, ai o scrisoare de la {p}: „Răcorește-te puțin!” ❄️",
      "Timpul s-a oprit pentru {o}. Doar {p} știe de ce.",
      "{p} n-a avut milă: {o} e acum un cub de gheață."
    ],
    frozen: [
      "Ai fost [înghețat|înghețată] de {o}! Stai [liniștit|liniștită], trece repede.",
      "Brrr, {p}! {o} ți-a tras frâna de mână la toată compania.",
      "Avioanele tale s-au transformat în sculpturi de gheață. Mulțumim, {o}…",
      "{p}, ai fost [pus|pusă] pe gheață. Respiră adânc și numără fulgii.",
      "{o} te-a congelat. Ai un Spărgător de gheață prin buzunare?",
      "Totul s-a oprit, {p}. Doar inima ta mai bate, de nervi.",
      "❄️ Iarnă în mijlocul zilei! {o} ți-a înghețat flota.",
      "Pasagerii tăi tremură, {p}. {o} își face plinul cu ei.",
      "{p}, ești [blocat|blocată] ca un frigider vechi. Rezistă!",
      "{o} a venit cu frigul. Tu vii cu răbdarea, {p}.",
      "Ai fost [înghețat|înghețată]! Poți doar să privești… și să plănuiești răzbunarea.",
      "Gheață pe aripi, gheață în conturi. {p}, aștepți dezghețul?"
    ],
    breaker: [
      "🔥 {p} a spart gheața! Planul pus la cale de {o} s-a topit.",
      "Surpriză, {o}! {p} avea un Spărgător de gheață în buzunar.",
      "{p} a topit gheața într-o clipă. {o} rămâne cu buza umflată.",
      "Crac! Gheața s-a spart, {p} zboară mai departe.",
      "{o} a încercat, {p} a ripostat: dezgheț instant!",
      "{p} nu se lasă [înghețat|înghețată] așa ușor!",
      "Flăcări contra gheții: {p} câștigă runda asta.",
      "{p} a aprins chibritul la momentul perfect. Pa-pa, gheață!",
      "Frigul trimis de {o} n-a ținut nicio secundă. {p} e de neoprit.",
      "{p} a anulat înghețul. {o} se uită lung la cartea irosită.",
      "Primăvară instant pentru {p}! Gheața s-a dus pe apa sâmbetei.",
      "{p} a spart gheața cu stil. {o}, mai încearcă!"
    ],
    draftPick: [
      "{p} a ales: {card}.",
      "{p} trage o carte… {card}!",
      "{p} întoarce cartea: {card}.",
      "{card} pentru {p}. Alegere înțeleaptă sau noroc chior?",
      "{p} a ales cu ochii închiși și a nimerit {card}.",
      "Hop, {card} ajunge la {p}.",
      "{p} ia {card}. Ceilalți notează în carnețel.",
      "{p} a fost [inspirat|inspirată]: {card}.",
      "Cartea se întoarce: {card}! {p} o pune în buzunar.",
      "{p} a mers pe instinct: {card}.",
      "Și {p} primește… {card}!",
      "{p} a ezitat o secundă, apoi a luat {card}."
    ],
    draftSpecial: [
      "Uau! {p} a tras o carte specială: {card}!",
      "Specială! {card} ajunge la {p}. Ceilalți înghit în sec.",
      "{p} a nimerit {card}. Masa amuțește.",
      "Ding-ding! {card} pentru {p}!",
      "Noroc chior: {p} ia {card}.",
      "{p} a dat lovitura: {card}!",
      "Atenție toată lumea, {p} are acum {card}.",
      "{card}! {p} zâmbește ca [un vulpoi|o vulpiță].",
      "Ce mână! {p} scoate {card}.",
      "O carte rară pentru {p}: {card}.",
      "{p} ține strâns {card}. Nimeni nu știe ce va face cu ea.",
      "Cineva [să-l|s-o] verifice pe {p}! Iar a tras {card}."
    ],
    draftWhisper: [
      "Psst, {p}! Cartea numărul {n} e {card}.",
      "Consultantul îți șoptește: „Sub numărul {n} se ascunde {card}.”",
      "Am aflat de la un prieten de la tipografie: cartea {n} e {card}.",
      "{p}, nu spune nimănui: la poziția {n} e {card}.",
      "Informație confidențială: {card} stă sub cartea {n}.",
      "Am tras cu ochiul, {p}: cartea {n} e {card}. Factura vine mâine.",
      "Ssst! Cartea {n}? {card}. Eu n-am zis nimic.",
      "Sursele mele confirmă: la {n} e {card}.",
      "{p}, ascultă la mine: {card} e la numărul {n}.",
      "Un pont de aur: cartea {n} ascunde {card}.",
      "Pariez onorariul meu că la {n} e {card}.",
      "Între noi doi, {p}: {card} se află la poziția {n}."
    ],
    draftTurn: [
      "E rândul tău, {p}! Alege o carte.",
      "{p}, masa te așteaptă. Care carte?",
      "Hai, {p}, mâna pe o carte!",
      "Ceasul ticăie, {p}. Alege!",
      "Toți ochii pe tine, {p}.",
      "{p}, simți vreo vibrație norocoasă? Alege acum.",
      "Rândul tău, {p}. Nu te gândi prea mult… sau gândește-te repede.",
      "{p}, cărțile sunt cu fața în jos, norocul e cu fața spre tine.",
      "Alege cu inima, {p}!",
      "Tic-tac, {p}! Altfel alege soarta pentru tine.",
      "{p}, e momentul tău de glorie. O carte, te rog!",
      "Hai, {p}, arată-ne ce instinct ai!"
    ],
    draftMissed: [
      "Iată ce ați ratat: {card}.",
      "Cărțile rămase se întorc: {card}. Ofuri pe toată masa.",
      "Ce-ar fi fost dacă…: {card}.",
      "Pe masă au rămas: {card}. Mâine e altă zi.",
      "Ups! Printre cele rămase: {card}.",
      "Dezvăluire finală: {card}.",
      "N-a luat nimeni: {card}. Păcat?",
      "Cărțile uitate: {card}. Se duc înapoi în pachet.",
      "Momentul adevărului: {card}.",
      "Ia uite ce stătea ascuns: {card}.",
      "Regrete de seară: {card}.",
      "Restul cărților: {card}. Cine plânge primul?"
    ],
    negoOpen: [
      "{p} și {o} negociază… ceasul lumii stă în loc.",
      "Ușile biroului s-au închis: {p} discută afaceri cu {o}.",
      "Cafea, contracte, priviri tăioase: {p} și {o} negociază.",
      "Toată lumea așteaptă: {p} <îl|o> invită pe {o} la masa tratativelor.",
      "{p} a bătut la ușă. {o} a deschis. Încep negocierile.",
      "Pauză pentru toți: {p} și {o} au ceva de discutat.",
      "Între patru ochi: {p} și {o}.",
      "Diplomație aeriană în desfășurare: {p} și {o}.",
      "Se aude un pix care semnează? Încă nu. {p} și {o} negociază.",
      "Masa e pusă, ofertele zboară: {p} față în față cu {o}.",
      "{p} <l-a chemat|a chemat-o> pe {o} la birou.",
      "Tratative la nivel înalt: {p} și {o}. Ceilalți, răbdare!"
    ],
    negoPhrases: [
      "Hai să facem o afacere bună pentru amândoi!",
      "Ofertă finală. Sau aproape finală.",
      "Nu mă grăbesc, am tot timpul din lume. La propriu: ceasul e oprit.",
      "E prea puțin, nu crezi?",
      "Pot să fac un efort, dar mic.",
      "Sunt [sigur|sigură] că ne înțelegem.",
      "Îți dau un sfat de prieten: acceptă.",
      "Asta e o glumă, nu?",
      "Mai pune ceva și batem palma.",
      "Nu ți-aș face niciodată rău. Acum.",
      "Sună bine! Aproape prea bine…",
      "Sunt [deschis|deschisă] la contraoferte.",
      "Hai că mă enervezi frumos.",
      "Batem palma? 🤝",
      "Mă gândesc… 🤔",
      "{o}, ești <un negociator dur|o negociatoare dură>!",
      "Sunt [obosit|obosită] de vorbe, vreau cifre.",
      "Ți-am mai zis că-mi placi ca partener de afaceri?"
    ],
    negoAccept: [
      "🤝 {p} și {o} au bătut palma!",
      "Afacere încheiată! {p} și {o} își strâng mâinile.",
      "Semnat! {p} și {o} pleacă amândoi zâmbind.",
      "Înțelegere! Pixul a scris, ștampila a bătut.",
      "{p} și {o} au căzut de acord. Cine a câștigat? Rămâne de văzut.",
      "{p} a acceptat oferta făcută de {o}.",
      "Contract parafat între {p} și {o}.",
      "Bravo vouă, {p} și {o}! Comerțul înflorește.",
      "Afacerea s-a făcut. {p} e [mulțumit|mulțumită], {o} pare <mulțumit|mulțumită>.",
      "Da! {p} a zis da. {o} sărbătorește.",
      "{p} și {o} au ajuns la o înțelegere. Lumea respiră din nou.",
      "Hârtiile sunt semnate. Ceasul pornește iar."
    ],
    negoRefuse: [
      "{p} a refuzat. {o} își strânge hârtiile.",
      "Nu, mulțumesc! {p} nu vrea afacerea.",
      "{p} a scuturat din cap. Fără înțelegere azi.",
      "Refuz categoric de la {p}. {o} trebuie să vină cu ceva mai bun.",
      "{p} a rupt oferta în două. Elegant, dar ferm.",
      "Negocieri eșuate. {p} și {o} se privesc chiorâș.",
      "{p}: „Nici în visele tale!” {o} ia notă.",
      "Fără acord. Data viitoare poate, {o}.",
      "{p} a zis nu. {o} pleacă <supărat|supărată>.",
      "Masa tratativelor s-a strâns fără rezultat.",
      "{p} nu s-a lăsat [convins|convinsă].",
      "Oferta a fost respinsă. {o} se gândește la planul B."
    ],
    negoCounter: [
      "{p} vine cu o contraofertă. Șah pe bani.",
      "Nu chiar așa: {p} propune altceva.",
      "{p} rescrie oferta cu pixul roșu.",
      "Contraofertă! {o}, e rândul tău.",
      "{p} a mai tăiat din sume și a mai adăugat condiții.",
      "„Ce zici de asta?” întreabă {p}.",
      "{p} nu acceptă, dar nici nu pleacă: contraofertă!",
      "Mingea e la {o}. {p} a făcut contraoferta.",
      "{p} a modificat oferta. Negocierea se încinge.",
      "O nouă ciornă pe masă, semnată de {p}.",
      "{p} a fost [viclean|vicleană]: contraofertă cu surprize.",
      "Ping-pong de oferte: acum servește {p}."
    ],
    loanAsk: [
      "{p} <îl|o> roagă pe {o} să-i împrumute {a}.",
      "{p} are nevoie de {a}. {o}, ai un ban de prisos?",
      "Cerere de împrumut: {p} → {o}, {a}.",
      "{p} bate timid la ușă: „Ai cumva {a}?”",
      "{p} vrea {a} cu împrumut. Promite că dă înapoi. Promite.",
      "Între prieteni: {p} cere {a} de la {o}.",
      "{p} întinde mâna spre {o}: are nevoie de {a}.",
      "SOS financiar: {p} cere {a}.",
      "{o}, {p} te roagă frumos: {a}, pe termen scurt.",
      "{p} are o idee genială și îi lipsesc doar {a}.",
      "Împrumut cerut: {a}. {p} jură pe toată flota că returnează.",
      "{p} trimite o cerere de {a} către {o}. Cu inimioare."
    ],
    loanRepaid: [
      "{p} și-a plătit datoria de {a} către {o}. Onoare!",
      "{o} a primit înapoi {a} de la {p}. Prietenia rămâne intactă.",
      "Datorie stinsă! {p} a returnat {a} până la ultimul eurocent.",
      "{p} e [om de cuvânt|femeie de cuvânt]: {a} returnați la timp.",
      "Bani înapoi, conștiință curată: {p} → {o}, {a}.",
      "{o} zâmbește: împrumutul de {a} s-a întors acasă.",
      "{p} a achitat {a}. {o} poate dormi <liniștit|liniștită>.",
      "Contul companiei {oc} se îngroașă cu {a}, plătiți corect de {p}.",
      "{p} a returnat {a}. Încredere câștigată, prietenie consolidată.",
      "Termenul a sosit, banii au sosit: {a} de la {p} la {o}.",
      "Împrumut închis! {p} și {o} rămân parteneri buni.",
      "{p} a plătit tot, fără să clipească: {a}."
    ],
    loanCollect: [
      "{o} și-a încasat împrumutul: {a} de la {p}, vrând-nevrând.",
      "Termenul a expirat! {o} ia {a} din contul companiei {c}.",
      "Datoria se plătește: {p} cedează {a} către {o}, chiar dacă doare.",
      "{p} spera că {o} a uitat. N-a uitat: {a} încasați.",
      "Executare silită prietenească: {a} de la {p} la {o}.",
      "{p} a rămas mai [sărac|săracă] cu {a}. {o} și-a luat partea.",
      "Ceasul a bătut ora plății: {o} încasează {a}.",
      "{o} a trimis factura, banca a executat-o: −{a} pentru {p}.",
      "{p}, {o} ți-a luat înapoi {a}. Se pare că împrumuturile chiar se returnează.",
      "Împrumutul s-a închis automat: {a} au plecat de la {p}.",
      "{o} își recuperează banii. {p} își recalculează planurile.",
      "Fără scuze, fără amânări: {a} încasați de {o}."
    ],
    pact: [
      "{p} și {o} au semnat un pact de neagresiune pe {n} zile. Fără gheață între ei!",
      "Pace pe cer! {p} și {o} nu se mai îngheață {n} zile.",
      "Pact semnat: {p} și {o} promit să-și lase avioanele în pace {n} zile.",
      "Porumbeii păcii zboară între {p} și {o}. Valabil {n} zile.",
      "{p} și {o} au bătut palma: armistițiu de {n} zile.",
      "O alianță s-a născut! {p} și {o}, uniți {n} zile.",
      "Tratatul de la masa de negocieri: {p} + {o}, {n} zile de liniște.",
      "{p} și {o} și-au jurat prietenie… pentru {n} zile.",
      "Fără înghețuri între {p} și {o} timp de {n} zile. Ceilalți să fie atenți!",
      "Pact semnat cu cerneală albastră: {p} și {o}, {n} zile.",
      "{p} și {o} au decis să fie prieteni {n} zile. Apoi vedem.",
      "Armistițiu! {n} zile fără gheață între {p} și {o}."
    ],
    bankLoan: [
      "{p} a luat un credit de {a} pe {n} zile. Bancherul zâmbește.",
      "Banca a deschis seiful: {a} pentru {p}, de plătit în {n} zile.",
      "{p} s-a împrumutat cu {a}. Rata zilnică vine cu dobândă.",
      "Credit aprobat! {p} are {a} în plus și o rată în agendă.",
      "{p} a semnat la bancă pentru {a}. Pixul tremura un pic.",
      "{a} pe datorie: {p} investește în viitor.",
      "Bancherul i-a strâns mâna: {p} pleacă cu {a}.",
      "Bani de la bancă pentru {p}: {a} pe {n} zile.",
      "{p} a luat {a} credit. Să fie cu spor!",
      "Banca are încredere în {p}: {a}, scadență în {n} zile.",
      "{p} a făcut un credit de {a}. Dobânda deja numără zilele.",
      "Infuzie de capital: {a} pentru {p}."
    ],
    cashLow: [
      "Atenție, {p}: ești pe minus! Ai {n} zile să-ți revii.",
      "{p}, contul e roșu ca un semafor. {n} zile până la faliment!",
      "Alarmă financiară! {p} are {n} zile să iasă de pe minus.",
      "{p}, banca te privește lung. Mai ai {n} zile.",
      "Minus în cont, {p}! Vinde, împrumută, negociază: {n} zile rămase.",
      "Contabilul a leșinat. {p}, ai {n} zile să-l trezești cu vești bune.",
      "{p} e pe minus. Ceasul ticăie: {n} zile.",
      "Situație critică, {p}! {n} zile până când vin executorii.",
      "{p}, poate un credit sau o vânzare? Mai ai {n} zile.",
      "Roșu, roșu, roșu… {p}, ai {n} zile să schimbi culoarea.",
      "{p}, nu intra în panică. Ba da, intră puțin: {n} zile.",
      "Bani negativi pentru {p}. Termen de salvare: {n} zile."
    ],
    consultantIntro: [
      "Bună ziua, {p}! Sunt consultantul tău. Facturez la oră, dar și sfaturile sunt pe măsură.",
      "Salutare, [șefu'|șefa]! Am adus grafice, cafea și idei.",
      "{p}, de azi lucrăm împreună. Eu am ideile, tu ai banii.",
      "Încântat de cunoștință, {p}! Am 20 de ani de experiență în aviație. Și doi în ghicit cărți.",
      "Am studiat compania ta, {p}. Avem de lucru.",
      "Bună, {p}! Promit sfaturi bune. Nu promit că sunt ieftine.",
      "{p}, am semnat contractul. Primul sfat: nu mă concedia.",
      "Consultantul a sosit! {p}, unde e biroul meu cu vedere la pistă?",
      "Salut, {p}! Am o geantă plină de tabele și o inimă plină de optimism.",
      "Gata, {p}, de acum nu mai ești [singur|singură] cu cifrele.",
      "Bine te-am găsit, {p}! Am deja trei idei. Două sunt bune.",
      "{p}, eu citesc piața, tu citești sfaturile. Ne-am înțeles?"
    ],
    consultantFire: [
      "Am înțeles, {p}. Îmi strâng graficele și plec.",
      "Ok, {p}… dar să știi că sfatul de mâine era genial.",
      "Concediat? Bine. Las pe birou ultimul tabel, {p}.",
      "{p}, a fost o plăcere. Factura vine prin poștă.",
      "Plec, {p}, dar cafeaua o iau cu mine.",
      "Mult succes, {p}! Sună-mă când dai de greu.",
      "Ți-am lăsat un bilețel: „Nu uita de prețuri!” Pa, {p}!",
      "M-ai concediat cu stil. Mulțumesc oricum, {p}.",
      "Bine, {p}. Mă duc să-l consiliez pe altcineva.",
      "Fără mine o să fie mai multă liniște, {p}. Și mai puține idei.",
      "{p}, rămâi cu bine. Și cu grafice în ordine.",
      "Contract reziliat. {p}, ne vedem la următoarea criză."
    ],
    special: [
      "{p} joacă {card}! Toată lumea ține respirația.",
      "Carte specială pe masă: {card}, jucată de {p}.",
      "{p} scoate asul din mânecă: {card}.",
      "Bum! {p} a folosit {card}.",
      "{card} în acțiune! Semnează {p}.",
      "{p} a ales momentul perfect pentru {card}.",
      "Magie de birou: {p} activează {card}.",
      "{p} a jucat {card}. Ceilalți își notează să fie atenți.",
      "Atenție, cer! {p} folosește {card}.",
      "{p} a scos {card} din sertar. Strategie sau inspirație?",
      "{card}! {p} nu glumește.",
      "Lovitură tactică: {p} joacă {card}."
    ],
    eventIntro: [
      "Știri de ultimă oră: {d}",
      "Breaking news din lumea aviației: {d}",
      "Atenție, companii! {d}",
      "Buletin de știri: {d}",
      "Turnul de control anunță: {d}",
      "Ziarul de dimineață scrie: {d}",
      "Telefoanele sună în toate birourile: {d}",
      "Flash: {d}",
      "Știre fierbinte: {d}",
      "Ultima oră pe toate ecranele din aeroport: {d}",
      "Agenția de presă transmite: {d}",
      "Între timp, în lume: {d}"
    ],
    dayStart: [
      "Ziua {n} începe. Cafeaua e caldă, pistele sunt libere.",
      "Bună dimineața, lume! Ziua {n} în aviație.",
      "Ziua {n}: soarele răsare, motoarele pornesc.",
      "Începe ziua {n}. Pasagerii își fac deja bagajele.",
      "Ziua {n} pe cer. Să zburăm!",
      "Alarma sună: ziua {n}. Avioanele vă așteaptă.",
      "Ziua {n}. Prețurile sunt fixate, echipajele pregătite.",
      "Hai, companii, ziua {n} nu așteaptă pe nimeni!",
      "Pagina {n} din jurnalul de zbor e albă. Scrieți-o frumos!",
      "Ziua {n}: alt cer, alte oportunități.",
      "Ziua {n} a început. Cine zboară primul?",
      "Bun venit în ziua {n}! Turnul de control e deschis."
    ],
    leader: [
      "{p} trece pe primul loc! Coroana îi stă bine.",
      "Schimbare la vârf: {p} conduce acum!",
      "{c} e cea mai valoroasă companie din lume. Bravo, {p}!",
      "{p} a urcat în fruntea clasamentului. Ceilalți, la treabă!",
      "Nou lider: {p}! Ceilalți se uită în oglinda retrovizoare.",
      "{p} e pe primul loc. Să vedem cât ține.",
      "Podiumul are un nou ocupant pe treapta de sus: {p}.",
      "{p} i-a depășit pe toți. Respect!",
      "Primul loc pentru {p}. Ține-te bine de el!",
      "{p} e acum [liderul|lidera] cerului.",
      "Clasamentul s-a schimbat: {p} e în frunte!",
      "{p} conduce cursa. Restul, accelerați!"
    ],
    sharesBuy: [
      "{p} a cumpărat {n} acțiuni ale companiei {oc}. {o} ridică o sprânceană.",
      "Mișcare la bursă: {p} investește în {oc} ({n} acțiuni).",
      "{p} crede în {oc}: {n} acțiuni cumpărate.",
      "{o}, ai un acționar nou: {p} cu {n} acțiuni.",
      "{p} a luat o bucățică din {oc}: {n} acțiuni.",
      "Bursa fierbe: {n} acțiuni {oc} ajung la {p}.",
      "{p} pariază pe succesul companiei {oc}: {n} acțiuni.",
      "{p} își diversifică portofoliul cu {n} acțiuni {oc}.",
      "{o} are de acum un partener tăcut: {p}.",
      "{n} acțiuni {oc} schimbă proprietarul. Noul stăpân: {p}.",
      "{p} a cumpărat {n} acțiuni de la {oc}. Prietenie sau strategie?",
      "Investiție curajoasă: {p} intră în acționariatul companiei {oc}."
    ],
    invest: [
      "{p} pune banii la treabă: o investiție nouă pentru {c}.",
      "Macarale pe pistă! {p} investește în viitorul companiei {c}.",
      "{p} nu ține banii la saltea: încă o investiție pentru {c}.",
      "Contabilul aprobă din cap: {p} a investit cu cap.",
      "{c} crește și pe dedesubt: {p} a semnat o investiție.",
      "{p} construiește pentru mâine. Ceilalți se uită cu coada ochiului.",
      "Panglică tăiată, foarfecă aurită: {p} inaugurează o investiție nouă.",
      "{p} e [hotărât|hotărâtă] să rămână pe cer mult timp: investiție nouă la {c}.",
      "Banii din cont s-au transformat în beton și tehnologie. Semnează {p}.",
      "Investiție pe termen lung: {p} se gândește deja la evaluarea finală.",
      "{p} a ales să investească în loc să numere banii. Înțelept!",
      "Inginerii companiei {c} au primit buget nou. {p} zâmbește [mulțumit|mulțumită]."
    ],
    gameEnd: [
      "{p} câștigă! {c} e cel mai mare imperiu aerian al lumii, cu {a}.",
      "Cerul are un stăpân: {p}! Valoare finală: {a}.",
      "Felicitări, {p}! {c} a cucerit lumea.",
      "{p} e [campionul|campioana] cerului cu {a}!",
      "Aplauze pentru {p}! Cea mai valoroasă companie: {c}.",
      "{p} a câștigat cursa aeriană. Șampanie pentru toată lumea!",
      "Victorie pentru {p}! {a} valoare finală.",
      "{p} urcă pe podium, pe treapta cea mai înaltă!",
      "Imperiul {c} domnește peste cer. Bravo, {p}!",
      "Jocul s-a încheiat: {p} e [regele|regina] aviației!",
      "{p} a dovedit că știe să zboare sus: {a}.",
      "Câștigătorul este… {p}! Ceilalți cer revanșa?"
    ]
  };

  /* ======================================================================================================
     SFATURI DE CONSULTANT — LOGIC.advice() alege o cheie și variabilele; tip(key, vars) face textul.
     prio: 1 (informativ) … 5 (urgent). TIP_VARS documentează variabilele fiecărei chei.
     ====================================================================================================== */
  const TIP_VARS = {
    emptySeats: "r(rută) pct(grad de ocupare) t(avion)", priceHigh: "r pct(cota ta de piață) a(prețul recomandat)",
    priceLow: "r a(prețul recomandat) pct(ocupare)", unprofitable: "r a(pierdere pe zi)", bigPlane: "t r", smallPlane: "t r pct",
    noPilot: "n(avioane care așteaptă) x", idlePlane: "t x", fuelUp: "pct(creștere)", fuelDown: "pct(scădere)",
    loanRisk: "a(datorie) n(zile)", cashLow: "a(bani) n(zile)", permitNext: "r n(cărți lipsă)", buildReady: "r",
    ghiseu: "card n", slotsScarce: "x n(sloturi rămase)", hubSuggest: "x n(rute prin aeroport)", competitor: "r o g og",
    season: "x loc(etichetă/sezon)", eventNow: "loc d", oldPlane: "t n(ani)", pact: "o", sharesCheap: "oc a(preț acțiune)",
    usedMarket: "t a(preț)", lease: "t", bankOk: "a(limită)", newRoute: "r", buyCards: "a(preț carte)", transit: "x y r",
    specialUse: "card", permitDiscard: "r", reputation: "n(stele)", generic: "—"
  };
  const T = (key, prio, text) => ({ key, prio, text });
  const TIPS = [
    T("emptySeats", 3, "Pe ruta {r} zbori cu doar {pct} locuri ocupate. Încearcă un preț mai mic sau un avion mai mic."),
    T("emptySeats", 3, "Văd multe scaune goale pe {r} ({pct}). Pasagerii nu mușcă la prețul ăsta."),
    T("priceHigh", 3, "Pe {r} ai doar {pct} din piață. Concurența e mai ieftină: un preț în jur de {a} ar aduce pasagerii înapoi."),
    T("priceHigh", 3, "Prețul tău pe {r} sperie lumea. Recomand cam {a}."),
    T("priceLow", 2, "Avioanele pe {r} pleacă pline ({pct}). Poți urca prețul spre {a} fără să pierzi pasageri."),
    T("priceLow", 2, "Lași bani pe masă pe {r}: lumea ar plăti și {a}."),
    T("unprofitable", 4, "Ruta {r} pierde în jur de {a} pe zi. Schimbă prețul, avionul… sau renunță la ea."),
    T("unprofitable", 4, "{r} e o gaură în buget: −{a} pe zi. Hai să reparăm asta."),
    T("bigPlane", 2, "Un {t} pe {r} e ca un autocar pentru doi turiști. Un avion mai mic ar consuma mai puțin."),
    T("bigPlane", 2, "{t}-ul de pe {r} e prea mare pentru cererea de acolo. Mută-l pe o rută mai aglomerată."),
    T("smallPlane", 3, "Pe {r}, {t}-ul pleacă mereu plin ({pct}) și rămân pasageri la poartă. E timpul pentru un avion mai mare."),
    T("smallPlane", 3, "Coada de pe {r} crește văzând cu ochii. Pune încă un avion sau unul mai mare."),
    T("noPilot", 4, "Ai {n} avioane care așteaptă la {x} să apeși „Decolează”. Un pilot le-ar trimite singur."),
    T("noPilot", 3, "Avioanele fără pilot stau la sol până apeși tu butonul. Angajează piloți pe rutele aglomerate."),
    T("idlePlane", 4, "{t}-ul de la {x} stă degeaba, fără rută. Avioanele parcate costă bani."),
    T("idlePlane", 3, "Ai un {t} liber la {x}. Atribuie-l unei rute sau vinde-l."),
    T("fuelUp", 3, "Combustibilul s-a scumpit cu {pct}. Rutele lungi cu avioane pe jumătate goale vor durea."),
    T("fuelUp", 3, "Kerosenul urcă ({pct}). Un Contract de combustibil ar prinde bine acum."),
    T("fuelDown", 2, "Combustibilul e mai ieftin cu {pct}. Momentul ideal pentru zboruri lungi!"),
    T("fuelDown", 1, "Kerosen ieftin ({pct} mai puțin)! Poți coborî puțin prețurile ca să furi pasageri."),
    T("loanRisk", 5, "Ai {a} datorii și ratele vin zilnic. Mai ai cam {n} zile până devine periculos."),
    T("loanRisk", 4, "Datoria de {a} începe să apese. Nu mai lua credite până nu cresc veniturile."),
    T("cashLow", 5, "Ai doar {a} în cont. Dacă intri pe minus, ai {n} zile să-ți revii. Atenție la cheltuieli!"),
    T("cashLow", 4, "Banii se termină ({a}). Amână cumpărăturile mari sau vinde un avion vechi."),
    T("permitNext", 2, "Pentru permisul {r} îți mai lipsesc doar {n} cărți. Merită să-l construiești următorul."),
    T("permitNext", 2, "Permisul {r} e aproape gata: {n} cărți și e al tău."),
    T("buildReady", 4, "Ai toate cărțile pentru {r}! Apasă „Construiește” cât e loc la aeroport."),
    T("buildReady", 3, "Ruta {r} poate fi construită chiar acum. Ce mai aștepți?"),
    T("ghiseu", 2, "Ai {n} cărți {card}. La Ghișeu le poți schimba pe exact ce-ți lipsește."),
    T("ghiseu", 1, "Prea multe {card} în mână ({n}). Fă un schimb la Ghișeu."),
    T("slotsScarce", 3, "La {x} mai sunt doar {n} sloturi libere. Cine ajunge primul se instalează."),
    T("slotsScarce", 3, "Aeroportul din {x} se umple. Ia un slot acolo înainte să-l ia altcineva."),
    T("hubSuggest", 2, "Ai {n} rute prin {x}. Un hub acolo ți-ar scădea taxele și ți-ar aduce pasageri în tranzit."),
    T("hubSuggest", 2, "{x} e deja inima rețelei tale. Gândește-te la un hub."),
    T("competitor", 3, "{o} a intrat pe ruta {r}. Pregătește-te pentru un război al prețurilor."),
    T("competitor", 2, "Pe {r} nu mai ești [singur|singură]: {o} zboară și <el|ea> acolo. Calitatea și prețul fac diferența."),
    T("season", 2, "Se apropie sezonul pentru {loc}: rutele spre {x} vor fi mai căutate."),
    T("season", 1, "Sezon bun la {x} ({loc}). E momentul să adaugi zboruri acolo."),
    T("eventNow", 3, "Atenție la {loc}: {d}"),
    T("eventNow", 2, "Evenimentul de la {loc} schimbă cererea. Ajustează prețurile pe rutele de acolo."),
    T("oldPlane", 2, "{t}-ul tău are {n} ani și tușește des. Penele îți strică reputația."),
    T("oldPlane", 2, "Un {t} de {n} ani ar trebui pensionat. Vinde-l cât mai valorează ceva."),
    T("pact", 1, "Un pact cu {o} te-ar scăpa de înghețuri neplăcute. Merită o discuție."),
    T("sharesCheap", 1, "Acțiunile companiei {oc} sunt ieftine acum ({a}). Dacă cresc, câștigi și tu."),
    T("usedMarket", 2, "În piața second-hand e un {t} la doar {a}. Chilipir, dar verifică vârsta."),
    T("lease", 2, "Nu ai bani pentru un {t}? Leasingul te pune pe cer fără avans."),
    T("bankOk", 1, "Banca ți-ar da până la {a}. Un credit pe termen scurt pentru o rută bună se plătește singur."),
    T("newRoute", 2, "Am analizat piața: {r} are cerere mare și puțină concurență."),
    T("buyCards", 1, "Prima carte cumpărată azi costă {a}. A doua e mai scumpă — nu exagera."),
    T("transit", 2, "Dacă legi {x} și {y} prin hubul tău, prinzi și pasagerii în tranzit pe {r}."),
    T("specialUse", 2, "Ai {card} în mână. Ține-l pentru momentul potrivit, dar nu-l uita în sertar."),
    T("permitDiscard", 1, "Permisul {r} nu prea merită. Poți renunța la el ca să tragi altele."),
    T("reputation", 2, "Reputația ta e de {n} stele. Avioanele noi și zborurile la timp o ridică."),
    T("generic", 1, "Totul arată bine. Continuă așa și ține un ochi pe concurență."),
    T("generic", 1, "Sfatul zilei: rutele scurte aduc bani repede, cele lungi aduc bani mulți.")
  ];

  /* ======================================================================================================
     REGULI (HTML pentru fereastra de reguli) — descriere fără numere exacte de echilibru (sunt afișate în joc).
     ====================================================================================================== */
  /* ===== ZIARUL DE DIMINEAȚĂ (R1): un titlu pe zi din evenimentele reale de ieri.
     Câmpuri: {co} {co2} companii, {x} {y} aeroporturi, {n} număr/sumă, {ev} eveniment, {loc} loc. ===== */
  const NEWS = [
    { k: "bankrupt", t: "Doliu în aviație: {co} a închis porțile. Pasagerii caută alt bilet, acționarii caută batista." },
    { k: "bankrupt", t: "{co} a aterizat forțat în faliment. Cutia neagră arată un singur cuvânt: „datorii”." },
    { k: "bankrupt", t: "Ultimul zbor al {co}: cu destinația „Istorie”, fără bilet de întoarcere." },
    { k: "rival", t: "Război pe {x}–{y}: {co} a intrat peste {co2}. Pasagerii freacă palmele, contabilii își rod unghiile." },
    { k: "rival", t: "{co2}, nu mai ești singură pe {x}–{y}! {co} vine cu avioane și zâmbete." },
    { k: "rival", t: "Vecini noi pe ruta {x}–{y}: {co} se mută lângă {co2}. Prima ceartă, la poartă." },
    { k: "rival", t: "Concurență pe {x}–{y}: {co} îi suflă pasagerii lui {co2}. Se anunță prețuri de toamnă." },
    { k: "freeze", t: "Frig la birou: {co} a înghețat-o pe {co2}. Angajații au primit fulare." },
    { k: "freeze", t: "{co2} s-a trezit cu țurțuri pe aripi. Martorii arată spre {co}." },
    { k: "freeze", t: "Lovitură rece: {co} pune {co2} la congelator. „Nimic personal”, spune purtătorul de cuvânt." },
    { k: "pioneer", t: "Premieră: {co} zboară primul între {x} și {y}. Primarii au tăiat panglica, pasagerii au tăiat coada." },
    { k: "pioneer", t: "{co} deschide ruta {x}–{y}. „Până ieri nici nu știam că se poate”, declară un pasager." },
    { k: "pioneer", t: "Pionierat pe cer: {co} leagă {x} de {y}. Hărțile se retipăresc." },
    { k: "event", t: "{ev} — {loc}. Companiile se uită la radar, pasagerii la ceas." },
    { k: "event", t: "Ultima oră: {ev} ({loc}). Cafeaua din aeroport se scumpește preventiv." },
    { k: "event", t: "{ev} în {loc}. Meteorologii zâmbesc, dispecerii nu." },
    { k: "eventCo", t: "{ev} la {co}. Telefoanele de la sediu nu se mai opresc." },
    { k: "eventCo", t: "Surpriză la {co}: {ev}. Directorul a aflat din ziar, ca toată lumea." },
    { k: "eventCo", t: "{co} în prim-plan: {ev}. Concurența urmărește cu floricele." },
    { k: "hub", t: "{co} își face hub la {x}. Taximetriștii din {x} își cumpără mașini noi." },
    { k: "hub", t: "Centrul lumii s-a mutat la {x}, anunță {co}, care tocmai și-a deschis hubul acolo." },
    { k: "invest", t: "{co} toarnă beton: investiții noi, macarale peste tot, ochelari de soare pentru acționari." },
    { k: "invest", t: "Șantier la {co}: „Construim viitorul”, spune directorul, cu cască pe cap." },
    { k: "deal", t: "Strângere de mână istorică: {co} și {co2} au bătut palma. Detaliile, la cafea." },
    { k: "deal", t: "{co} și {co2} au semnat o înțelegere. Avocații au plecat acasă fericiți." },
    { k: "pact", t: "Pace pe cer: {co} și {co2} semnează un pact pe {n} zile. Porumbeii albi au primit locuri la fereastră." },
    { k: "shares", t: "Bursa fierbe: {co} cumpără {n} acțiuni la {co2}. „E doar o investiție”, jură toată lumea." },
    { k: "shares", t: "{co} își bagă nasul în afacerile {co2}: {n} acțiuni dintr-odată." },
    { k: "climb", t: "Rachetă la bursă: {co} a crescut cu {n} într-o singură zi. Pilotul cere mărire." },
    { k: "climb", t: "{co} zboară sus: +{n} ieri. Concurența caută frâna de mână." },
    { k: "climb", t: "Zi de aur la {co}: +{n}. Directorul a comandat pizza pentru toată echipa." },
    { k: "climb", t: "Cine oprește {co}? +{n} într-o zi, și nici n-au transpirat." },
    { k: "fall", t: "Turbulențe la {co}: −{n} ieri. Centurile rămân cuplate." },
    { k: "fall", t: "{co} a pierdut {n} într-o zi. Contabilul a cerut concediu medical." },
    { k: "fall", t: "Gol de aer la {co}: −{n}. „E doar o corecție”, spune cineva foarte palid." },
    { k: "leader", t: "{co} conduce clasamentul cu {n}. Restul lumii se uită în sus." },
    { k: "leader", t: "Pe primul loc: {co}, cu {n}. Trofeul e deja lustruit." },
    { k: "leader", t: "{co} rămâne regele cerului: {n} valoare. Coroana e din aluminiu aeronautic." },
    { k: "pax", t: "{co} a dus ieri {n} pasageri. Nici un singur bagaj pierdut (oficial)." },
    { k: "pax", t: "Record de oameni zburători: {n} pasageri cu {co}. Covrigii de la bord s-au terminat." },
    { k: "pax", t: "{n} pasageri au ales ieri {co}. Ceilalți au ales trenul și regretă." },
    { k: "quiet", t: "Zi liniștită pe cer: pasagerii au ajuns, bagajele (aproape) toate." },
    { k: "quiet", t: "Nimic nou sub soare. Doar avioane, multe avioane." },
    { k: "quiet", t: "Calm plat în aviație. Jurnaliștii au scris despre vreme, din lipsă de scandal." },
    { k: "quiet", t: "Știrea zilei: nicio știre. Piloții au avut timp să-și lustruiască pantofii." }
  ];

  const RULES = [
    "<h3>Scopul jocului</h3>",
    "<p>Conduci o companie aeriană pe harta lumii, cu aproximativ 130 de aeroporturi reale. Construiești rute, cumperi avioane, stabilești prețuri și transporți pasageri. La final câștigă compania cu <b>cea mai mare valoare</b> (sau ultima rămasă în picioare, în modul „Fără timp”).</p>",
    "<h3>Pregătirea</h3>",
    "<ul><li>Fiecare jucător își alege un avatar, un nume, numele companiei și o culoare. Locurile goale pot fi luate de boți.</li>",
    "<li>Se votează durata partidei (1 h, 2 h, 3 h sau „Fără timp”) și lungimea unei zile de joc (1, 2 sau 3 minute reale).</li>",
    "<li>Fiecare companie primește o <b>bază</b> aleatoare (un oraș mare; toți jucătorii pornesc pe <b>același continent</b>, la câteva sute de kilometri unii de alții, ca să vă luptați pentru aceleași aeroporturi din prima zi), bani de pornire, o <b>rută de start</b> gratuită (de la bază la un aeroport apropiat; toți jucătorii primesc rute la fel de lungi și cu cerere asemănătoare) cu un avion gratuit deja pe ea (Turbo 72 sau Colibri 40, cu pilot automat), ca să câștigi bani din primul minut, 4 cărți de resursă și 3 permise de rută din care păstrează cel puțin unul.</li>",
    "<li><b>Start de companie</b>: în primele 10 zile de joc plătești doar jumătate din taxele de aterizare. Leasingul costă jumătate până în ziua 7, apoi crește treptat (60%, 70%, 80%, 90%) și e întreg din ziua 12.</li></ul>",
    "<p><b>Piețe bogate și sărace</b>: prețul normal al biletului depinde de piață — de la ×0,65 (Africa de Vest) la ×1,45 (America de Nord); rutele intercontinentale au o primă în plus. Porniți într-o piață modestă sau medie: extinderea spre piețele bogate aduce marje mult mai mari, dar acolo sloturile sunt mai scumpe și concurența e reală.</p>",
    "<h3>Timpul</h3>",
    "<p>Timpul curge continuu pentru toată lumea. Ceasul de sus arată ziua și ora. Ceasul se oprește singur doar la <b>draftul</b> de la sfârșitul zilei și în timpul <b>negocierilor</b>. Cât timp jocul e pus pe <b>pauză</b>, poți doar să privești sau să negociezi.</p>",
    "<h3>Rute: permise și cărți</h3>",
    "<ul><li><b>Permisul de rută</b> leagă două aeroporturi; cel puțin unul trebuie să fie deja în rețeaua ta (baza, un hub sau orice aeroport pe care îl deservești). Poți avea maximum 3 permise deschise. Când ai mai puțin de 3, poți trage alte 3 și păstrezi cel puțin unul. Renunțarea la un permis costă o mică penalitate.</li>",
    "<li>Permisele noi au cel mult <b>autonomia celui mai lung avion</b> pe care îl ai (cumpărat sau în leasing) + 10%; o companie nouă primește permise de până la 3.300 km. Cumperi un avion cu rază mai mare → primești permise mai lungi.</li>",
    "<li><b>Cărțile de resursă</b>: 🛂 Aprobare, 🏗️ Infrastructură, 👨‍✈️ Echipaj, ⛽ Combustibil. ⭐ <b>Joker</b> ține locul oricăreia. Fiecare permis cere o combinație de cărți: rutele scurte puține, cele intercontinentale multe.</li>",
    "<li>Pentru a construi îți trebuie și un <b>slot</b> la fiecare aeroport unde nu ești încă prezent. Aeroporturile mici au loc nelimitat, cele medii și mari au un număr limitat de sloturi pentru companii — cine vine primul se instalează.</li>",
    "<li>Primul care construiește o pereche de aeroporturi primește <b>bonusul de pionier</b> pentru 12 zile: cerere mai mare, reputație și atractivitate în plus față de rivali (×1,25 pe piețele modeste, până la ×1,55 pe cele foarte bogate).</li>",
    "<li><b>Ghișeul</b>: schimbi 5 cărți normale pe o carte normală la alegere. Poți și cumpăra cărți cu bani: fiecare cumpărare scumpește următoarea carte (×1,3), iar prețul se ieftinește la loc treptat (la jumătate în 12 ore de joc). Cărțile speciale nu se cumpără.</li>",
    "<li><b>Hubul</b> (scump) la un aeroport unde ești prezent: taxe de aterizare mai mici, bonus de tranzit mai mare și un slot rezervat.</li></ul>",
    "<h3>Avioanele</h3>",
    "<ul><li><b>Colibri 40</b> — navetă foarte ieftină, 40 de locuri, salturi de până la 1.100 km. <b>Turbo 72</b> — turbopropulsor regional, 70 de locuri, până la 1.800 km. <b>Regio 100</b> — jet regional rapid, 100 de locuri, până la 3.000 km. <b>Aero 320</b> — calul de povară, 180 de locuri, până la 5.000 km. <b>Cometa 230</b> — lung-curier mediu, 230 de locuri, până la 8.500 km. <b>Skyliner 350</b> — gigantul intercontinental, 320 de locuri.</li>",
    "<li>Le poți cumpăra noi, la mâna a doua (mai ieftine, dar mai vechi: pene mai dese, care strică reputația) sau în <b>leasing</b> (fără avans, cu chirie zilnică). Un avion se poate vinde oricând, la valoarea lui depreciată. Un avion nou intră în valoarea companiei cu prețul plătit și se depreciază treptat.</li>",
    "<li><b>Rută cu escală</b>: un avion poate zbura A→B→C și înapoi pe două rute ale tale cu un aeroport comun B. Duce pasagerii ambelor rute plus pasageri în plus de la A la C (dacă suma prețurilor și ocolul sunt convenabile și nimeni nu zboară direct A–C). Plătește taxe la fiecare oprire și stă mai mult la escală.</li>",
    "<li>Fiecare avion e atribuit unei singure rute (sau unei rute cu escală) și face naveta între capete. Raza lui trebuie să acopere distanța. Când atribui un avion unei rute vezi, pentru fiecare variantă, profitul estimat pe zi și cât de plin va zbura.</li></ul>",
    "<h3>Îmbarcarea și decolarea</h3>",
    "<ul><li>Pasagerii vin continuu la aeroport și așteaptă la coada companiei tale pentru ruta respectivă. Cei care așteaptă prea mult pleacă.</li>",
    "<li>La sol, avionul îmbarcă din coadă până se umple; îmbarcarea durează cel puțin 45 de minute de joc.</li>",
    "<li><b>Fără pilot</b>, avionul stă până apeși <b>„🛫 Decolează”</b> (pleacă cu câți pasageri are). <b>Cu pilot</b> (salariu zilnic), pleacă singur când e plin, când zborul e profitabil după o oră de așteptare sau după cel mult 6 ore.</li>",
    "<li>Mai multe avioane cu pilot pe aceeași rută și același sens <b>stau la rând</b>: doar cel de la poartă îmbarcă și pleacă la minimul lui, apoi îmbarcă următorul. Nu mai pleacă toate pe jumătate goale.</li>",
    "<li>Venitul (pasageri × preț bilet) se încasează la aterizare. Costurile de zbor sunt combustibilul, taxa de aterizare și echipajul. La sfârșitul zilei se plătesc întreținerea, leasingul, salariile și dobânzile.</li></ul>",
    "<h3>Prețuri și cota de piață</h3>",
    "<ul><li>Fiecare rută are un preț <b>Normal</b>, plus variantele <b>Ieftin</b> și <b>Premium</b>, și un preț <b>recomandat</b> care îți umple bine avioanele. Poți pune orice preț, pe fiecare sens sau pe amândouă.</li>",
    "<li>Cererea depinde de populația orașelor, de distanță, de sezon (plajă vara, schi iarna…), de evenimente și crește treptat pe rutele noi.</li>",
    "<li>Dacă mai multe companii zboară pe aceeași rută, pasagerii se împart după <b>atractivitate</b>: preț (cel mai important), frecvența zborurilor, reputație (stele) și bonusul de pionier.</li>",
    "<li><b>Tranzit</b>: dacă zbori A–H și H–X, primești și o parte din pasagerii care vor de la A la X.</li>",
    "<li>Informațiile sunt <b>private</b>: nu vezi prețurile, profiturile, cărțile sau permisele celorlalți — doar rutele, avioanele în zbor, stelele și clasamentul aproximativ.</li></ul>",
    "<h3>Draftul de la sfârșitul zilei</h3>",
    "<p>La finalul fiecărei zile ceasul se oprește. Pe masă stau cărți cu fața în jos (3 pentru fiecare jucător + 4). Pe rând — începe compania cu valoarea cea mai mică, apoi în ordine „șarpe” — fiecare alege câte o carte, de 3 ori. Ai 10 secunde, altfel se alege una la întâmplare. Fiecare carte luată se întoarce pentru toți, iar la final se arată și cele rămase. Urmează decontarea zilei și evenimentele.</p>",
    "<h3>Cărțile speciale</h3>",
    "<p>Sunt 37 în total; o carte jucată revine în pachet după 10 zile de joc.</p>",
    "<ul><li>❄️ <b>Îngheață timpul</b> (×6, max. 3 în mână): o companie adversă îngheață 30 de secunde reale — avioanele ei stau pe loc, chiar și în aer, și nu poate face nimic în afară de a juca 🔥. Pe rutele comune, toată cererea nouă vine la tine. Următorul îngheț abia după 2 zile; nu în pauze, nu pe cineva deja înghețat, nu pe un partener de pact.</li>",
    "<li>🔥 <b>Spărgător de gheață</b> (×4, max. 2): când ești înghețat ai 5 secunde să-l folosești și înghețul se anulează.</li>",
    "<li>🚀 <b>Construcție rapidă</b> (×4): construiești cu o carte mai puțin.</li>",
    "<li>🎟️ <b>Permis VIP</b> (×3): alegi liber orice permis fezabil.</li>",
    "<li>📈 <b>Boom de pasageri</b> (×4): cerere dublă pe una din rutele tale 3 zile.</li>",
    "<li>⛽ <b>Contract de combustibil</b> (×3): combustibil cu 30% mai ieftin 5 zile.</li>",
    "<li>🔍 <b>Spion</b> (×3): vezi prețul și profitul unei rute a unui adversar o zi.</li>",
    "<li>📣 <b>Campanie de reclamă</b> (×4): +1 stea 7 zile.</li>",
    "<li>🧯 <b>Asigurare</b> (×3): anulezi un eveniment negativ care te lovește.</li>",
    "<li>🏛️ <b>Slot suplimentar</b> (×2): un slot în plus, doar pentru tine, la un aeroport mare plin.</li>",
    "<li>✈️ <b>Avion cadou</b> (×1): un Turbo 72 gratuit.</li></ul>",
    "<h3>Evenimente</h3>",
    "<p>Lumea nu stă pe loc: nori de cenușă vulcanică, uragane, greve, ceață, sezonul vacanțelor și al schiului, campionate mondiale, festivaluri, crize ale petrolului, recenzii proaste, premii, subvenții și multe altele schimbă cererea și costurile pentru câteva zile.</p>",
    "<h3>Banca și falimentul</h3>",
    "<ul><li>Poți lua oricând un <b>credit</b> (fără pauză), până la jumătate din valoarea companiei minus datoriile, pe 10, 20 sau 30 de zile, cu rată zilnică și dobândă. Rambursarea anticipată e gratuită. Întârzierile și zilele pe minus îți scad scorul de credit.</li>",
    "<li>Dacă banii scad sub zero apare un avertisment roșu: ai 5 zile de joc să-ți revii. Dacă după 5 zile ești tot pe minus (sau datoria depășește limita), compania intră în <b>faliment</b>: avioanele sunt confiscate și ieși din joc. În partidele cu 3–4 jucători jocul continuă.</li>",
    "<li>În modul „Fără timp”, după ziua 60 crizele se înmulțesc: combustibilul și taxele cresc.</li></ul>",
    "<h3>Negocieri, împrumuturi și pacte</h3>",
    "<ul><li>Poți deschide o negociere cu un alt jucător (o dată pe zi, maximum 2 minute). Timpul se oprește pentru toți.</li>",
    "<li>Pe masă poți pune: bani, cărți normale și speciale, permise deschise, rute construite (cu sloturile lor; avioanele rămân), sloturi, avioane, <b>pacte de neagresiune</b> (nu vă puteți îngheța N zile) și <b>împrumuturi</b> (sumă, sumă de returnat, termen — se încasează automat la scadență, chiar dacă împinge datornicul pe minus).</li>",
    "<li>Răspunsuri: <b>Accept</b>, <b>Refuz</b> sau <b>Contraofertă</b>. „Cere împrumut” deschide direct o cerere de bani.</li></ul>",
    "<h3>Consultantul și piloții</h3>",
    "<p>Consultantul (plătit zilnic) îți dă sfaturi la fiecare 1–2 zile pe baza datelor tale: locuri goale, prețuri prea mari sau prea mici, rute în pierdere, avioane nepotrivite, riscul datoriilor, ce permis să construiești. Uneori îți șoptește ce carte se ascunde la draft. Piloții se angajează pe fiecare avion și îl fac să decoleze singur la momentul potrivit.</p>",
    "<h3>Bursa</h3>",
    "<p>Fiecare companie are 100 de acțiuni. Ceilalți pot cumpăra până la 49 dintr-o companie, la prețul valoare/100 (+2% comision); proprietarul le poate răscumpăra. La final, acțiunile valorează același procent din valoarea finală a companiei.</p>",
    "<h3>Investiții</h3>",
    "<p>Când banii se adună, îi poți investi (fila 🏗️ Investiții): <b>Extinde baza</b> (3 niveluri: mai multă cerere pe rutele din bază, un slot în plus și taxe mai mici acolo), <b>Terminal propriu</b> într-un aeroport mare unde ești prezent (pasagerii te aleg mai des acolo, reputație în plus), <b>Flotă eco</b> pentru un tip de avion (mai puțin combustibil) și <b>Centru de mentenanță</b> (întreținere mai ieftină, mai puține pene). Investițiile valorează cât ai plătit, apoi pierd treptat 2% pe zi, până la minim jumătate; la final intră în valoarea companiei cu cât valorează atunci.</p>",
    "<h3>Sfârșitul jocului și punctajul</h3>",
    "<ol><li>Se plătesc datoriile la bancă.</li><li>Se decontează împrumuturile între jucători.</li>",
    "<li>Se adună valoarea avioanelor (depreciată), a rutelor, sloturilor și huburilor, plus valoarea investițiilor (cât ai plătit, minus 2% pe zi, minim jumătate).</li>",
    "<li>Se adaugă cărțile rămase (Jokerul și cărțile speciale valorează mai mult; 5 cărți la fel dau bonus de colecționar), minus o penalitate pentru fiecare permis neconstruit.</li>",
    "<li>Se adaugă valoarea acțiunilor deținute la alții.</li></ol>",
    "<p>Câștigă cea mai mare valoare. Urmează realizările și statisticile.</p>",
    "<h3>Sfaturi</h3>",
    "<ul><li>Începe cu rute scurte și profitabile din bază; nu lăsa avioanele să stea degeaba.</li>",
    "<li>Urmărește gradul de ocupare: avion gol = preț prea mare sau avion prea mare; coadă lungă = poți urca prețul sau adăuga avioane.</li>",
    "<li>Piloții te scapă de grija butonului „Decolează”.</li>",
    "<li>Ia sloturile de la aeroporturile mari devreme — se termină.</li>",
    "<li>Banii care stau degeaba nu aduc nimic: investește-i la timp.</li>",
    "<li>Păstrează un 🔥 Spărgător de gheață dacă ești pe primul loc.</li></ul>"
  ].join("\n");

  /* ======================================================================================================
     ȘABLOANE + API
     ====================================================================================================== */
  const PH = ["p", "o", "c", "oc", "a", "x", "y", "t", "n", "card", "r", "loc", "d", "pct"];
  /** fill(tpl, vars): {p} {o} {c} {oc} {a}(număr → fmtEur) {x} {y}(cod IATA → nume) {t}(id avion → nume) {n} {card}(id → icon+nume)
      {r} {loc} {d} {pct}; [masc|fem] după vars.g, <masc|fem> după vars.og ("m" implicit). Placeholderele lipsă rămân neatinse. */
  function fill(tpl, vars) {
    vars = vars || {};
    let s = String(tpl);
    s = s.replace(/\[([^\[\]|]*)\|([^\[\]|]*)\]/g, (m, a, b) => vars.g === "f" ? b : a);
    s = s.replace(/<([^<>|]*)\|([^<>|]*)>/g, (m, a, b) => vars.og === "f" ? b : a);
    s = s.replace(/\{([a-z]+)\}/g, (m, k) => {
      let v = vars[k];
      if (v == null) return m;
      if (k === "a" && typeof v === "number") v = fmtEur(v);
      else if ((k === "x" || k === "y") && AP[v]) v = AP[v].n;
      else if (k === "t" && AIRCRAFT[v]) v = AIRCRAFT[v].n;
      else if (k === "card" && CARDS[v]) v = cardName(v);
      else if (k === "pct" && typeof v === "number") v = Math.round(v) + "%";
      return String(v);
    });
    return s;
  }
  function _pickArr(arr, rng) {
    if (!Array.isArray(arr) || !arr.length) return null;
    const r = typeof rng === "function" ? rng() : Math.random();
    return arr[Math.floor(r * arr.length) % arr.length];
  }
  /** line(key, vars, rng?) → replică aleatoare completată ("" dacă cheia nu există). */
  function line(key, vars, rng) { const t = _pickArr(LINES[key], rng); return t == null ? "" : fill(t, vars); }
  /** tip(key, vars, rng?) → un sfat de consultant pentru cheia dată (sau "" dacă nu există). */
  function tip(key, vars, rng) {
    const arr = TIPS.filter(t => t.key === key);
    const t = _pickArr(arr, rng);
    return t ? fill(t.text, vars) : "";
  }
  function tipPrio(key) { const t = TIPS.find(x => x.key === key); return t ? t.prio : 0; }
  function eventById(id) { return EVENTS.find(e => e.id === id) || null; }

  const CerulData = {
    CONTINENTS, CONT_IDS, REGIONS, TAGS, SEASON, MONTHS, AIRPORTS, AP, AP_IDS, SIZE_NAMES, seasonMult,
    dist, distClass, gcPoint, bearing, fmtEur, fmtKm,
    AIRCRAFT, AIRCRAFT_IDS, PLANE_ORDER,
    CARDS, RES_IDS, SPECIAL_IDS, CARD_ODDS, SPECIALS, SPECIAL_RETURN_DAYS, SPECIAL_POOL_TOTAL, cardName,
    EVENTS, FX_DOC, FX_KEYS, SCOPE_DOC, eventById,
    AVATARS, COLORS,
    STATS_FIELDS, newStats, ACH, checkAch,
    LINES, LINE_VARS, line, fill, PH,
    TIPS, TIP_VARS, tip, tipPrio,
    RULES, NEWS
  };
  CerulData["fmt€"] = fmtEur;
  if (typeof window !== "undefined") window.CerulData = CerulData;
  if (typeof module !== "undefined" && module.exports) module.exports = CerulData;
})();
