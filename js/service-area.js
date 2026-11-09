/**
 * Service area for Midnight Express LKN.
 *
 * The customer's non-airport end must be in a served North Carolina town.
 * A trip to the airport checks the pickup. A pickup at the airport checks
 * the drop-off. A trip with no airport checks both ends. Charlotte Douglas,
 * Concord Regional, and private airfields count as the airport end, so that
 * end may sit outside the towns.
 *
 * Typed "Denver NC" or a ZIP that belongs only to a served town is enough.
 * "Denver" alone is not, because it is also Denver, Colorado. A shared ZIP
 * is not enough on its own. Geocoding is used only when the typed address
 * does not already decide the town. See docs/service-area.md.
 *
 * The live calendar is created in the browser by posting to Google Forms and
 * the calendar Apps Script. Both of those posts call evaluateTrip first.
 * The Apps Script project is not in this repository, so a request built by
 * hand against that URL is not covered until the same check is pasted there.
 */
(function (root) {
  "use strict";

  var OUT_OF_AREA_MESSAGE = "Sorry, we don't service that area.";
  var UNCLEAR_MESSAGE =
    "Please include the town and state, for example Denver, NC.";

  var SERVED_TOWNS = [
    ["pumpkin center", "Pumpkin Center"],
    ["sherrills ford", "Sherrills Ford"],
    ["sherrill ford", "Sherrills Ford"],
    ["iron station", "Iron Station"],
    ["lowesville", "Lowesville"],
    ["westport", "Westport"],
    ["denver", "Denver"],
    ["terrell", "Terrell"],
    ["catawba", "Catawba"],
    ["maiden", "Maiden"],
  ];

  var UNSERVED_TOWNS = [
    ["huntersville", "Huntersville"],
    ["mooresville", "Mooresville"],
    ["statesville", "Statesville"],
    ["cornelius", "Cornelius"],
    ["charlotte", "Charlotte"],
    ["davidson", "Davidson"],
    ["troutman", "Troutman"],
  ];

  // USPS preferred city is the served town, and the ZIP is not shared with
  // a town we do not serve. Westport mail uses 28037. 28609's alias
  // "Longisland" is the Long Island community in Catawba, which is served.
  var SERVED_ZIPS = {
    28037: "Denver",
    28080: "Iron Station",
    28609: "Catawba",
    28650: "Maiden",
    28673: "Sherrills Ford",
    28682: "Terrell",
  };

  // Preferred city is a town the owner does not serve.
  var UNSERVED_ZIPS = {
    28031: "Cornelius",
    28035: "Davidson",
    28036: "Davidson",
    28070: "Huntersville",
    28078: "Huntersville",
    28115: "Mooresville",
    28117: "Mooresville",
    28166: "Troutman",
    28625: "Statesville",
    28677: "Statesville",
    28687: "Statesville",
  };

  // 28164's preferred city is Stanley. Lowesville is only an alias.
  var BORDER_ZIPS = {
    28164: "Lowesville and Stanley share 28164. Stanley is not served.",
  };

  var UNCERTAIN_NOTES = [
    "28164 is shared by Lowesville (served) and Stanley (not served). The ZIP alone is not accepted.",
    "Pumpkin Center and Westport have no ZIP of their own. Westport is mailed as Denver 28037. Pumpkin Center is accepted only when the address names it. 28092 is Lincolnton and is not a served ZIP.",
    "28677 is Statesville. Its aliases include East Monbo and Eufola, which are not on the served-town list.",
    "28078 is Huntersville. Its aliases include Caldwell, Hicks Crossroads, and Long Creek, which are not served towns.",
    "282xx is Charlotte's ZIP range. No served town uses it. 28227 also reaches Mint Hill, which is not served. 28262 is the ZIP for 8109 Pike Road, Charlotte.",
  ];

  var ABBR = {
    AL: "AL",
    AK: "AK",
    AZ: "AZ",
    AR: "AR",
    CA: "CA",
    CO: "CO",
    CT: "CT",
    DE: "DE",
    DC: "DC",
    FL: "FL",
    GA: "GA",
    HI: "HI",
    ID: "ID",
    IL: "IL",
    IN: "IN",
    IA: "IA",
    KS: "KS",
    KY: "KY",
    LA: "LA",
    ME: "ME",
    MD: "MD",
    MA: "MA",
    MI: "MI",
    MN: "MN",
    MS: "MS",
    MO: "MO",
    MT: "MT",
    NE: "NE",
    NV: "NV",
    NH: "NH",
    NJ: "NJ",
    NM: "NM",
    NY: "NY",
    NC: "NC",
    ND: "ND",
    OH: "OH",
    OK: "OK",
    OR: "OR",
    PA: "PA",
    RI: "RI",
    SC: "SC",
    SD: "SD",
    TN: "TN",
    TX: "TX",
    UT: "UT",
    VT: "VT",
    VA: "VA",
    WA: "WA",
    WV: "WV",
    WI: "WI",
    WY: "WY",
  };

  var STATE_NAME = {
    alabama: "AL",
    alaska: "AK",
    arizona: "AZ",
    arkansas: "AR",
    california: "CA",
    colorado: "CO",
    connecticut: "CT",
    delaware: "DE",
    florida: "FL",
    georgia: "GA",
    hawaii: "HI",
    idaho: "ID",
    illinois: "IL",
    indiana: "IN",
    iowa: "IA",
    kansas: "KS",
    kentucky: "KY",
    louisiana: "LA",
    maine: "ME",
    maryland: "MD",
    massachusetts: "MA",
    michigan: "MI",
    minnesota: "MN",
    mississippi: "MS",
    missouri: "MO",
    montana: "MT",
    nebraska: "NE",
    nevada: "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    ohio: "OH",
    oklahoma: "OK",
    oregon: "OR",
    pennsylvania: "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    tennessee: "TN",
    texas: "TX",
    utah: "UT",
    vermont: "VT",
    virginia: "VA",
    washington: "WA",
    "west virginia": "WV",
    wisconsin: "WI",
    wyoming: "WY",
  };

  // Last-token collisions with street directions and the abbreviation for court.
  var NOT_TRAILING_STATE = { ne: true, nw: true, se: true, sw: true, ct: true };

  var STREET_SUFFIX = {
    dr: true,
    drive: true,
    rd: true,
    road: true,
    st: true,
    street: true,
    ln: true,
    lane: true,
    way: true,
    ct: true,
    court: true,
    blvd: true,
    boulevard: true,
    ave: true,
    avenue: true,
    cir: true,
    circle: true,
    pl: true,
    place: true,
    trl: true,
    trail: true,
    pkwy: true,
    parkway: true,
    hwy: true,
    highway: true,
    pike: true,
  };

  function pad(text) {
    return " " + text + " ";
  }

  function has(text, phrase) {
    return pad(text).indexOf(pad(phrase)) !== -1;
  }

  function blocked(text, phrase) {
    return has(text, "not " + phrase) || has(text, "not the " + phrase);
  }

  function normalize(raw) {
    return String(raw || "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function airportNorm(raw) {
    return String(raw || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchTown(text, towns) {
    var padded = pad(text);
    var ordered = towns.slice().sort(function (a, b) {
      return b[0].length - a[0].length;
    });
    for (var i = 0; i < ordered.length; i++) {
      if (padded.indexOf(pad(ordered[i][0])) !== -1) return ordered[i][1];
    }
    return null;
  }

  function findZips(text) {
    var found = [];
    var re = /\b(\d{5})(?:\d{4})?\b/g;
    var match;
    while ((match = re.exec(text))) found.push(match[1]);
    return found;
  }

  function zipClass(zip) {
    if (SERVED_ZIPS[zip]) return { kind: "served", town: SERVED_ZIPS[zip] };
    if (BORDER_ZIPS[zip]) return { kind: "border" };
    if (UNSERVED_ZIPS[zip]) return { kind: "unserved", town: UNSERVED_ZIPS[zip] };
    if (/^282\d{2}$/.test(zip)) return { kind: "unserved", town: "Charlotte" };
    return { kind: "unknown" };
  }

  function findState(text) {
    var tokens = text.split(" ").filter(Boolean);
    var zipAt = -1;
    for (var z = 0; z < tokens.length; z++) {
      if (/^\d{5}$/.test(tokens[z])) {
        zipAt = z;
        break;
      }
    }
    if (zipAt > 0) {
      var abbr = tokens[zipAt - 1].toUpperCase();
      if (ABBR[abbr]) return ABBR[abbr];
      if (zipAt >= 2) {
        var pair = tokens[zipAt - 2] + " " + tokens[zipAt - 1];
        if (STATE_NAME[pair]) return STATE_NAME[pair];
      }
    }
    var named = null;
    for (var i = 0; i < tokens.length; i++) {
      var two =
        i + 1 < tokens.length ? tokens[i] + " " + tokens[i + 1] : "";
      if (two && STATE_NAME[two]) named = STATE_NAME[two];
      else if (STATE_NAME[tokens[i]]) named = STATE_NAME[tokens[i]];
    }
    var last = tokens[tokens.length - 1];
    if (ABBR[last.toUpperCase()] && !NOT_TRAILING_STATE[last]) {
      return ABBR[last.toUpperCase()];
    }
    return named;
  }

  // Passenger door or FBO door, not the middle of the runway.
  // CLT main is the airline curb. CLT private is Wilson Air Center at
  // 5400 Airport Drive, also used for Signature and "Charlotte private airport".
  // Concord airline passengers use the Allegiant terminal at 7435 Zephyr Place NW.
  // Concord private flights use the FBO at 9000 Aviation Blvd.
  var AIRPORTS = [
    {
      id: "CLT",
      kind: "airline",
      name: "Charlotte Douglas Airport (CLT)",
      menu: "Charlotte Douglas International (CLT)",
      typed: "CLT",
      lat: 35.2224,
      lon: -80.9423,
      aliases: [
        "clt",
        "charlotte douglas",
        "douglas international",
        "douglas intl",
        "charlotte airport",
        "charlotte international",
      ],
    },
    {
      id: "JQF-PAX",
      kind: "airline",
      name: "Concord Regional passenger terminal (Allegiant)",
      menu: "Concord-Padgett Regional (JQF)",
      typed: "Allegiant",
      lat: 35.38044,
      lon: -80.71382,
      aliases: [
        "allegiant",
        "concord allegiant",
        "7435 zephyr",
        "zephyr place",
        "concord passenger terminal",
        "concord regional passenger",
        "concord padgett regional",
      ],
    },
    {
      id: "KIPJ",
      kind: "private",
      name: "Lincolnton-Lincoln County Regional (KIPJ)",
      menu: "Lincolnton (KIPJ)",
      typed: "KIPJ",
      lat: 35.48424,
      lon: -81.16304,
      aliases: [
        "kipj",
        "lincolnton lincoln county",
        "lincolnton regional",
        "lincolnton airport",
      ],
    },
    {
      id: "CLT-PRIVATE",
      kind: "private",
      name: "CLT private terminal (Wilson Air Center)",
      menu: "Charlotte private jets (Wilson/Signature, Modern Aviation)",
      typed: "Wilson Air Center",
      lat: 35.20975,
      lon: -80.93157,
      aliases: [
        "wilson air center",
        "5400 airport drive",
        "5400 airport dr",
        "signature flight support",
        "signature at clt",
        "charlotte private airport",
        "clt private",
        "modern aviation",
      ],
    },
    {
      id: "JQF",
      kind: "private",
      name: "Concord Regional Airport",
      menu: "Concord private jets",
      typed: "Concord Regional",
      lat: 35.3856,
      lon: -80.71246,
      aliases: [
        "kjqf",
        "jqf",
        "concord padgett",
        "concord regional",
        "concord airport",
        "9000 aviation",
      ],
    },
    {
      id: "EQY",
      kind: "private",
      name: "Charlotte-Monroe Executive (EQY)",
      menu: "Charlotte-Monroe Executive (EQY)",
      typed: "EQY",
      lat: 35.016833,
      lon: -80.620083,
      aliases: [
        "eqy",
        "keqy",
        "charlotte monroe",
        "monroe executive",
        "charlotte monroe executive",
      ],
    },
    {
      id: "8A6",
      kind: "private",
      name: "Wilgrove Air Park (8A6)",
      menu: "Wilgrove Air Park (8A6)",
      typed: "8A6",
      lat: 35.213611,
      lon: -80.670278,
      aliases: ["8a6", "wilgrove", "wilgrove air park"],
    },
    {
      id: "LITTLE-MOUNTAIN",
      kind: "private",
      name: "Little Mountain Airport",
      menu: "Little Mountain (Airport Rd, Maiden)",
      typed: "Little Mountain Airport",
      lat: 35.5918,
      lon: -81.07952,
      aliases: ["little mountain airport"],
    },
  ];

  function lookupAirport(raw) {
    var text = airportNorm(raw);
    if (!text) return null;
    var found = [];
    var seen = {};
    for (var i = 0; i < AIRPORTS.length; i++) {
      var airport = AIRPORTS[i];
      var best = 0;
      for (var a = 0; a < airport.aliases.length; a++) {
        var alias = airport.aliases[a];
        if (has(text, alias) && !blocked(text, alias) && alias.length > best) {
          best = alias.length;
        }
      }
      if (best > 0 && !seen[airport.id]) {
        seen[airport.id] = true;
        found.push(airport);
      }
    }
    if (
      (text === "airport" || text === "the airport") &&
      !seen.CLT
    ) {
      found.push(AIRPORTS[0]);
    }
    if (!found.length) return null;
    var specific = [];
    var generic = [];
    for (var j = 0; j < found.length; j++) {
      var id = found[j].id;
      if (id === "CLT" || id === "JQF") generic.push(found[j]);
      else specific.push(found[j]);
    }
    if (specific.length > 1) return null;
    if (specific.length === 1) return specific[0];
    if (generic.length > 1) return null;
    return generic[0];
  }

  function whichAirport(raw) {
    var found = lookupAirport(raw);
    return found ? found.id : null;
  }

  function isPrivateAirfield(raw) {
    var text = normalize(raw);
    if (!text) return false;
    if (has(text, "private airport")) {
      var after = text.split("private airport")[1].trim().split(" ")[0];
      if (!after || !STREET_SUFFIX[after]) return true;
    }
    var tokens = text.split(" ");
    for (var i = 0; i < tokens.length; i++) {
      if (
        tokens[i] !== "airpark" &&
        tokens[i] !== "airfield" &&
        tokens[i] !== "airstrip"
      ) {
        continue;
      }
      var next = tokens[i + 1] || "";
      if (STREET_SUFFIX[next]) continue;
      return true;
    }
    return false;
  }

  function isAirportEnd(raw) {
    return Boolean(whichAirport(raw)) || isPrivateAirfield(raw);
  }

  function classifyAddress(raw) {
    var text = normalize(raw);
    if (text.length === 0) {
      return { status: "unclear" };
    }
    var state = findState(text);
    var zips = findZips(text).map(zipClass);
    var unservedTown = matchTown(text, UNSERVED_TOWNS);
    var servedTown = matchTown(text, SERVED_TOWNS);
    if (unservedTown) return { status: "outside", town: unservedTown };
    for (var i = 0; i < zips.length; i++) {
      if (zips[i].kind === "unserved") {
        return { status: "outside", town: zips[i].town };
      }
    }
    if (state && state !== "NC") return { status: "outside" };
    var goodZip = null;
    var border = false;
    for (var j = 0; j < zips.length; j++) {
      if (!goodZip && zips[j].kind === "served") goodZip = zips[j];
      if (zips[j].kind === "border") {
        border = true;
      }
    }
    if (servedTown && (state === "NC" || goodZip || border)) {
      return { status: "served", town: servedTown };
    }
    var zipTown = goodZip ? goodZip.town : "";
    var result = { status: "unclear" };
    if (zipTown) {
      result = { status: "served", town: zipTown };
    } else if (servedTown) {
      result = { status: "unclear", town: servedTown };
    } else {
      result = { status: "unclear" };
    }
    return result;
  }

  function classifyEnd(text, geo) {
    if (isAirportEnd(text)) return { status: "airport" };
    var fromText = classifyAddress(text);
    if (fromText.status === "unclear" && geo) {
      var line = [geo.city, geo.state, geo.zip].filter(Boolean).join(" ");
      var fromGeo = classifyAddress(line);
      if (fromGeo.status !== "unclear") return fromGeo;
      if (geo.city && geo.state) return { status: "outside", town: geo.city };
    }
    return fromText;
  }

  function evaluateTrip(input) {
    var data = input || {};
    var pickup = data.pickupIsAirfield
      ? { status: "airport" }
      : classifyEnd(data.pickup, data.pickupGeo);
    var destination = data.destinationIsAirfield
      ? { status: "airport" }
      : classifyEnd(data.destination, data.destinationGeo);
    var required = [pickup, destination].filter(function (end) {
      return end.status !== "airport";
    });
    for (var i = 0; i < required.length; i++) {
      if (required[i].status === "outside") {
        return { ok: false, code: "outside", message: OUT_OF_AREA_MESSAGE };
      }
    }
    for (var j = 0; j < required.length; j++) {
      if (required[j].status !== "served") {
        return { ok: false, code: "unclear", message: UNCLEAR_MESSAGE };
      }
    }
    return { ok: true, code: "ok", message: "" };
  }

  var api = {
    OUT_OF_AREA_MESSAGE: OUT_OF_AREA_MESSAGE,
    UNCLEAR_MESSAGE: UNCLEAR_MESSAGE,
    SERVED_ZIPS: SERVED_ZIPS,
    UNSERVED_ZIPS: UNSERVED_ZIPS,
    BORDER_ZIPS: BORDER_ZIPS,
    UNCERTAIN_NOTES: UNCERTAIN_NOTES,
    AIRPORTS: AIRPORTS,
    lookupAirport: lookupAirport,
    whichAirport: whichAirport,
    isAirportEnd: isAirportEnd,
    isPrivateAirfield: isPrivateAirfield,
    classifyAddress: classifyAddress,
    classifyEnd: classifyEnd,
    evaluateTrip: evaluateTrip,
  };
  root.MidnightServiceArea = api;
})(globalThis);
