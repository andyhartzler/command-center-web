// Tracked Aircraft Database
// Maps notable operators/individuals to their known ICAO hex codes

export interface TrackedOperator {
  name: string;
  icao_hex: string[];
  category: "celebrity" | "government" | "corporate" | "sports" | "media" | "billionaire" | "aviation" | "military";
  description?: string;
}

export interface PotusAircraft {
  name: string;
  designation: string;
  icao_hex: string[];
  type: string;
}

// ── POTUS Fleet ─────────────────────────────────────────────────────────────

export const POTUS_FLEET: PotusAircraft[] = [
  {
    name: "Air Force One / Air Force Two",
    designation: "VC-25A",
    icao_hex: ["AE0001", "AE0002"],
    type: "Boeing 747-200B",
  },
  {
    name: "Marine One (VH-3D Sea King)",
    designation: "VH-3D",
    icao_hex: ["AE0460", "AE0461", "AE0462", "AE0463", "AE0464", "AE0465"],
    type: "Sikorsky VH-3D",
  },
  {
    name: "Marine One (VH-60N White Hawk)",
    designation: "VH-60N",
    icao_hex: ["AE0466", "AE0467", "AE0468", "AE0469", "AE046A", "AE046B"],
    type: "Sikorsky VH-60N",
  },
  {
    name: "E-4B Nightwatch (Doomsday Plane)",
    designation: "E-4B",
    icao_hex: ["AE041A", "AE041B", "AE041C", "AE041D"],
    type: "Boeing E-4B",
  },
  {
    name: "C-32A (Executive Transport)",
    designation: "C-32A",
    icao_hex: ["AE0042", "AE0044"],
    type: "Boeing 757-200",
  },
  {
    name: "C-40B/C Clipper",
    designation: "C-40B/C",
    icao_hex: ["AE049A", "AE049B", "AE049C", "AE049D"],
    type: "Boeing 737-700",
  },
  {
    name: "VC-25B (Next Gen Air Force One)",
    designation: "VC-25B",
    icao_hex: ["AE0003", "AE0004"],
    type: "Boeing 747-8",
  },
];

// ── Tracked Operators ───────────────────────────────────────────────────────

export const TRACKED_OPERATORS: TrackedOperator[] = [
  // ─── Billionaires / Tech ───
  {
    name: "Elon Musk",
    icao_hex: ["A835AF", "A1B07C"],
    category: "billionaire",
    description: "Tesla / SpaceX CEO",
  },
  {
    name: "Jeff Bezos",
    icao_hex: ["A97BFB", "A3ECBE"],
    category: "billionaire",
    description: "Amazon founder",
  },
  {
    name: "Bill Gates",
    icao_hex: ["A36B63", "A06E8D", "A1243A"],
    category: "billionaire",
    description: "Microsoft co-founder",
  },
  {
    name: "Mark Zuckerberg",
    icao_hex: ["A64816", "A13ECE"],
    category: "billionaire",
    description: "Meta CEO",
  },
  {
    name: "Larry Ellison",
    icao_hex: ["A1DE11", "A4798D"],
    category: "billionaire",
    description: "Oracle co-founder",
  },
  {
    name: "Larry Page",
    icao_hex: ["A0B8E7", "A0D8F8"],
    category: "billionaire",
    description: "Google co-founder",
  },
  {
    name: "Sergey Brin",
    icao_hex: ["A98814", "A0DB25"],
    category: "billionaire",
    description: "Google co-founder",
  },
  {
    name: "Eric Schmidt",
    icao_hex: ["A2B07C", "A59BD3"],
    category: "billionaire",
    description: "Former Google CEO",
  },
  {
    name: "Michael Bloomberg",
    icao_hex: ["A17B35", "ACB950"],
    category: "billionaire",
    description: "Bloomberg LP founder",
  },
  {
    name: "Steve Ballmer",
    icao_hex: ["A3F59D"],
    category: "billionaire",
    description: "Former Microsoft CEO / LA Clippers owner",
  },
  {
    name: "Ken Griffin",
    icao_hex: ["A326CA", "A77C10", "A40C47"],
    category: "billionaire",
    description: "Citadel founder",
  },
  {
    name: "Peter Thiel",
    icao_hex: ["A5A83E"],
    category: "billionaire",
    description: "PayPal co-founder / Palantir",
  },
  {
    name: "Richard Branson",
    icao_hex: ["400943"],
    category: "billionaire",
    description: "Virgin Group founder",
  },
  {
    name: "Jared Isaacman",
    icao_hex: ["A93174", "A1CD85"],
    category: "billionaire",
    description: "Shift4 Payments CEO / astronaut",
  },
  {
    name: "Michael Saylor",
    icao_hex: ["A08106"],
    category: "billionaire",
    description: "MicroStrategy founder",
  },
  {
    name: "Jan Koum",
    icao_hex: ["A0C979"],
    category: "billionaire",
    description: "WhatsApp co-founder",
  },
  {
    name: "David Geffen",
    icao_hex: ["AB0ABB"],
    category: "billionaire",
    description: "DreamWorks co-founder",
  },
  {
    name: "Evan Spiegel",
    icao_hex: ["A6C912"],
    category: "billionaire",
    description: "Snapchat CEO",
  },
  {
    name: "John Malone",
    icao_hex: ["A78D6A"],
    category: "billionaire",
    description: "Liberty Media chairman",
  },
  {
    name: "Stephen Schwarzman",
    icao_hex: ["A70832"],
    category: "billionaire",
    description: "Blackstone CEO",
  },
  {
    name: "Nelson Peltz",
    icao_hex: ["A0F3C0"],
    category: "billionaire",
    description: "Trian Fund Management",
  },
  {
    name: "Mark Cuban",
    icao_hex: ["A18AB5"],
    category: "billionaire",
    description: "Dallas Mavericks owner / Shark Tank",
  },
  {
    name: "Phil Knight",
    icao_hex: ["A24A94", "A5A1C1"],
    category: "billionaire",
    description: "Nike co-founder",
  },
  {
    name: "Charles Koch",
    icao_hex: ["A17747"],
    category: "billionaire",
    description: "Koch Industries",
  },
  {
    name: "Stanley Druckenmiller",
    icao_hex: ["A7E8A0"],
    category: "billionaire",
    description: "Duquesne Family Office",
  },
  {
    name: "Leon Black",
    icao_hex: ["A58C27"],
    category: "billionaire",
    description: "Apollo Global Management",
  },
  {
    name: "David Rubenstein",
    icao_hex: ["A31A5D"],
    category: "billionaire",
    description: "Carlyle Group co-founder",
  },
  {
    name: "Paul Tudor Jones",
    icao_hex: ["AA4A76"],
    category: "billionaire",
    description: "Tudor Investment Corp",
  },
  {
    name: "Robert Kraft",
    icao_hex: ["A3C9A1", "AC3E16"],
    category: "billionaire",
    description: "New England Patriots owner",
  },
  {
    name: "David Tepper",
    icao_hex: ["A14C37"],
    category: "billionaire",
    description: "Carolina Panthers owner / Appaloosa Management",
  },
  {
    name: "Jim Simons",
    icao_hex: ["A44E19"],
    category: "billionaire",
    description: "Renaissance Technologies",
  },
  {
    name: "Winklevoss Twins",
    icao_hex: ["A5E9F2"],
    category: "billionaire",
    description: "Gemini / crypto investors",
  },
  {
    name: "Grant Cardone",
    icao_hex: ["A74FD1"],
    category: "billionaire",
    description: "Cardone Capital",
  },
  {
    name: "Andrew Forrest",
    icao_hex: ["7C4984"],
    category: "billionaire",
    description: "Fortescue Metals founder",
  },
  {
    name: "Aliko Dangote",
    icao_hex: ["054241"],
    category: "billionaire",
    description: "Dangote Group",
  },
  {
    name: "Jack Ma",
    icao_hex: ["780D67"],
    category: "billionaire",
    description: "Alibaba founder",
  },

  // ─── Celebrities ───
  {
    name: "Taylor Swift",
    icao_hex: ["A3C0E9", "AA3D3C"],
    category: "celebrity",
    description: "Singer-songwriter",
  },
  {
    name: "Drake",
    icao_hex: ["C078A0"],
    category: "celebrity",
    description: "Rapper / artist (Air Drake)",
  },
  {
    name: "Jay-Z",
    icao_hex: ["A2E5AE"],
    category: "celebrity",
    description: "Rapper / entrepreneur",
  },
  {
    name: "Oprah Winfrey",
    icao_hex: ["A61443", "A88A01"],
    category: "celebrity",
    description: "Media mogul",
  },
  {
    name: "Kim Kardashian",
    icao_hex: ["A73F19"],
    category: "celebrity",
    description: "Media personality",
  },
  {
    name: "Kylie Jenner",
    icao_hex: ["A2DE69"],
    category: "celebrity",
    description: "Media personality / entrepreneur",
  },
  {
    name: "Tom Cruise",
    icao_hex: ["A68C01", "A0B0D5"],
    category: "celebrity",
    description: "Actor / pilot",
  },
  {
    name: "John Travolta",
    icao_hex: ["AB2E8A", "A5D899"],
    category: "celebrity",
    description: "Actor / pilot",
  },
  {
    name: "Harrison Ford",
    icao_hex: ["A0F9D9", "A578CF"],
    category: "celebrity",
    description: "Actor / pilot",
  },
  {
    name: "Tyler Perry",
    icao_hex: ["A46101"],
    category: "celebrity",
    description: "Actor / filmmaker",
  },
  {
    name: "Steven Spielberg",
    icao_hex: ["A88355"],
    category: "celebrity",
    description: "Director / producer",
  },
  {
    name: "George Lucas",
    icao_hex: ["A15E17"],
    category: "celebrity",
    description: "Director / Star Wars creator",
  },
  {
    name: "DJ Khaled",
    icao_hex: ["A6B4EB"],
    category: "celebrity",
    description: "DJ / producer",
  },
  {
    name: "Pitbull",
    icao_hex: ["A39D95"],
    category: "celebrity",
    description: "Rapper / Mr. Worldwide",
  },
  {
    name: "Floyd Mayweather",
    icao_hex: ["A6A4C1"],
    category: "celebrity",
    description: "Boxer",
  },
  {
    name: "Paris Hilton",
    icao_hex: ["A5C7A1"],
    category: "celebrity",
    description: "Socialite / entrepreneur",
  },
  {
    name: "Kid Rock",
    icao_hex: ["A4D5D4"],
    category: "celebrity",
    description: "Musician",
  },
  {
    name: "Blake Shelton",
    icao_hex: ["A0F55C"],
    category: "celebrity",
    description: "Country singer",
  },
  {
    name: "Garth Brooks",
    icao_hex: ["AA38B8"],
    category: "celebrity",
    description: "Country singer",
  },
  {
    name: "Kenny Chesney",
    icao_hex: ["A0C1B6"],
    category: "celebrity",
    description: "Country singer",
  },
  {
    name: "Luke Bryan",
    icao_hex: ["A85FA1"],
    category: "celebrity",
    description: "Country singer",
  },
  {
    name: "Keith Urban",
    icao_hex: ["A61B90"],
    category: "celebrity",
    description: "Country singer",
  },
  {
    name: "Dierks Bentley",
    icao_hex: ["A09FC3"],
    category: "celebrity",
    description: "Country singer",
  },
  {
    name: "George Strait",
    icao_hex: ["A42E8B"],
    category: "celebrity",
    description: "Country singer",
  },
  {
    name: "Rihanna",
    icao_hex: ["A91C60"],
    category: "celebrity",
    description: "Singer / entrepreneur",
  },
  {
    name: "J Balvin",
    icao_hex: ["A1E1E5"],
    category: "celebrity",
    description: "Reggaeton artist",
  },
  {
    name: "Mark Wahlberg",
    icao_hex: ["AB3F28"],
    category: "celebrity",
    description: "Actor / producer",
  },
  {
    name: "Jim Carrey",
    icao_hex: ["A42DE3"],
    category: "celebrity",
    description: "Actor / comedian",
  },
  {
    name: "Jerry Seinfeld",
    icao_hex: ["A25731"],
    category: "celebrity",
    description: "Comedian / actor",
  },
  {
    name: "Tony Robbins",
    icao_hex: ["A7FE91"],
    category: "celebrity",
    description: "Motivational speaker",
  },
  {
    name: "Dan Bilzerian",
    icao_hex: ["A92441"],
    category: "celebrity",
    description: "Social media personality",
  },
  {
    name: "Rick Ross",
    icao_hex: ["A49CB2"],
    category: "celebrity",
    description: "Rapper",
  },
  {
    name: "Sammy Hagar",
    icao_hex: ["A74FC9"],
    category: "celebrity",
    description: "Rock singer",
  },
  {
    name: "Dr. Phil",
    icao_hex: ["A58312"],
    category: "celebrity",
    description: "TV personality",
  },
  {
    name: "Sebastian Maniscalco",
    icao_hex: ["A2B971"],
    category: "celebrity",
    description: "Comedian",
  },

  // ─── Sports ───
  {
    name: "Michael Jordan",
    icao_hex: ["AB56B4"],
    category: "sports",
    description: "Basketball legend / Charlotte Hornets",
  },
  {
    name: "Tiger Woods",
    icao_hex: ["A13469"],
    category: "sports",
    description: "Golfer",
  },
  {
    name: "Lionel Messi",
    icao_hex: ["E49406"],
    category: "sports",
    description: "Soccer star",
  },
  {
    name: "Cristiano Ronaldo",
    icao_hex: ["4CA961"],
    category: "sports",
    description: "Soccer star",
  },
  {
    name: "Patrick Mahomes",
    icao_hex: ["A1C7E1"],
    category: "sports",
    description: "NFL quarterback (part owner of aircraft)",
  },
  {
    name: "Alex Rodriguez",
    icao_hex: ["A4B6A2"],
    category: "sports",
    description: "Former MLB player / investor",
  },
  {
    name: "Aaron Rodgers",
    icao_hex: ["A2C82E"],
    category: "sports",
    description: "NFL quarterback",
  },
  {
    name: "Russell Wilson",
    icao_hex: ["A9A61D"],
    category: "sports",
    description: "NFL quarterback",
  },
  {
    name: "Drew Brees",
    icao_hex: ["AA86F9"],
    category: "sports",
    description: "Former NFL quarterback",
  },
  {
    name: "Jason Kelce",
    icao_hex: ["A3FA25"],
    category: "sports",
    description: "Former NFL center",
  },
  {
    name: "Troy Aikman",
    icao_hex: ["A53D13"],
    category: "sports",
    description: "Former NFL quarterback / broadcaster",
  },
  {
    name: "John Elway",
    icao_hex: ["A3C7B1"],
    category: "sports",
    description: "Former NFL quarterback",
  },
  {
    name: "Rory McIlroy",
    icao_hex: ["43C215"],
    category: "sports",
    description: "Golfer",
  },
  {
    name: "Sergio Garcia",
    icao_hex: ["A5B99D"],
    category: "sports",
    description: "Golfer",
  },
  {
    name: "Max Verstappen",
    icao_hex: ["471F91"],
    category: "sports",
    description: "Formula 1 driver",
  },
  {
    name: "Fernando Alonso",
    icao_hex: ["34011C"],
    category: "sports",
    description: "Formula 1 driver",
  },
  {
    name: "Lance Stroll",
    icao_hex: ["C04CFF"],
    category: "sports",
    description: "Formula 1 driver",
  },
  {
    name: "Sergio Perez",
    icao_hex: ["0D0B4C"],
    category: "sports",
    description: "Formula 1 driver",
  },
  {
    name: "Magic Johnson",
    icao_hex: ["A4C83D"],
    category: "sports",
    description: "Basketball legend / entrepreneur",
  },
  {
    name: "Shaq",
    icao_hex: ["A39267"],
    category: "sports",
    description: "Basketball legend / investor",
  },
  {
    name: "Brad Keselowski",
    icao_hex: ["A0B88C"],
    category: "sports",
    description: "NASCAR driver",
  },
  {
    name: "Denny Hamlin",
    icao_hex: ["AB1D09"],
    category: "sports",
    description: "NASCAR driver",
  },
  {
    name: "Dale Earnhardt Family",
    icao_hex: ["A21A37"],
    category: "sports",
    description: "NASCAR dynasty",
  },
  {
    name: "Tony Stewart",
    icao_hex: ["A75F82"],
    category: "sports",
    description: "NASCAR driver / team owner",
  },
  {
    name: "Chase Elliott",
    icao_hex: ["A0916A"],
    category: "sports",
    description: "NASCAR driver",
  },

  // ─── Sports Team Owners ───
  {
    name: "Jerry Jones",
    icao_hex: ["A480E4", "AA6851"],
    category: "sports",
    description: "Dallas Cowboys owner",
  },
  {
    name: "Dan Snyder",
    icao_hex: ["A5A54E", "A61A2D"],
    category: "sports",
    description: "Former Washington Commanders owner",
  },
  {
    name: "Arthur Blank",
    icao_hex: ["A32F54", "A2F8C4"],
    category: "sports",
    description: "Atlanta Falcons owner / Home Depot",
  },
  {
    name: "Shahid Khan",
    icao_hex: ["A34DEE"],
    category: "sports",
    description: "Jacksonville Jaguars owner",
  },
  {
    name: "Jim Crane",
    icao_hex: ["A5C3AA"],
    category: "sports",
    description: "Houston Astros owner",
  },
  {
    name: "John Henry",
    icao_hex: ["A54D6F"],
    category: "sports",
    description: "Boston Red Sox / Liverpool FC owner",
  },
  {
    name: "Ted Leonsis",
    icao_hex: ["A1CC1A"],
    category: "sports",
    description: "Washington Capitals / Wizards owner",
  },
  {
    name: "Joe Tsai",
    icao_hex: ["A18CB7"],
    category: "sports",
    description: "Brooklyn Nets owner / Alibaba",
  },
  {
    name: "Stan Kroenke",
    icao_hex: ["A26F91", "A3BD46"],
    category: "sports",
    description: "LA Rams / Arsenal owner",
  },
  {
    name: "Tilman Fertitta",
    icao_hex: ["A10A69", "A8C12B"],
    category: "sports",
    description: "Houston Rockets owner / Landry's",
  },
  {
    name: "Robert Pera",
    icao_hex: ["A61023"],
    category: "sports",
    description: "Memphis Grizzlies owner / Ubiquiti",
  },

  // ─── Corporate ───
  {
    name: "Walmart (Walton Family)",
    icao_hex: ["A0D971", "A34481", "AB7AF8"],
    category: "corporate",
    description: "Walton family fleet",
  },
  {
    name: "Coca-Cola",
    icao_hex: ["A169D8", "A16A9A"],
    category: "corporate",
    description: "Coca-Cola Company",
  },
  {
    name: "Google",
    icao_hex: ["A2B445", "A05E39"],
    category: "corporate",
    description: "Alphabet corporate fleet",
  },
  {
    name: "Amazon",
    icao_hex: ["A83D04"],
    category: "corporate",
    description: "Amazon corporate",
  },
  {
    name: "Apple",
    icao_hex: ["A2A34C"],
    category: "corporate",
    description: "Apple corporate",
  },
  {
    name: "Nike",
    icao_hex: ["A0F3E0", "A13BA0"],
    category: "corporate",
    description: "Nike corporate fleet",
  },
  {
    name: "Disney",
    icao_hex: ["A20A68", "A14E28"],
    category: "corporate",
    description: "Walt Disney Company",
  },
  {
    name: "Goldman Sachs",
    icao_hex: ["A4E3C8"],
    category: "corporate",
    description: "Investment bank",
  },
  {
    name: "JP Morgan",
    icao_hex: ["A3CDBA", "A6BF55"],
    category: "corporate",
    description: "JP Morgan Chase",
  },
  {
    name: "Berkshire Hathaway",
    icao_hex: ["AA91CD", "A32C9E"],
    category: "corporate",
    description: "Warren Buffett's company",
  },
  {
    name: "FedEx",
    icao_hex: ["A5D1E0"],
    category: "corporate",
    description: "FedEx corporate",
  },
  {
    name: "Dell",
    icao_hex: ["A1543B", "AB3FE3"],
    category: "corporate",
    description: "Dell Technologies (Michael Dell)",
  },
  {
    name: "Oracle",
    icao_hex: ["A7C4E3"],
    category: "corporate",
    description: "Oracle corporate",
  },
  {
    name: "Chick-Fil-A",
    icao_hex: ["A0BD08"],
    category: "corporate",
    description: "Chick-Fil-A corporate",
  },
  {
    name: "Hobby Lobby",
    icao_hex: ["A67C4E"],
    category: "corporate",
    description: "Hobby Lobby / Green family",
  },
  {
    name: "Publix",
    icao_hex: ["A41A66"],
    category: "corporate",
    description: "Publix Supermarkets",
  },
  {
    name: "Koch Industries",
    icao_hex: ["A17748", "A71A06"],
    category: "corporate",
    description: "Koch Industries fleet",
  },
  {
    name: "Caterpillar",
    icao_hex: ["A3D8C2"],
    category: "corporate",
    description: "Caterpillar Inc.",
  },
  {
    name: "John Deere",
    icao_hex: ["A1B34E"],
    category: "corporate",
    description: "Deere & Company",
  },
  {
    name: "Lockheed Martin",
    icao_hex: ["A34F30"],
    category: "corporate",
    description: "Defense contractor",
  },
  {
    name: "Raytheon",
    icao_hex: ["A6FC01"],
    category: "corporate",
    description: "RTX Corporation",
  },
  {
    name: "General Dynamics",
    icao_hex: ["A2AD84"],
    category: "corporate",
    description: "Defense / Gulfstream parent",
  },
  {
    name: "Honeywell",
    icao_hex: ["A1E4CE", "A7B3F8"],
    category: "corporate",
    description: "Honeywell Aerospace",
  },
  {
    name: "Chevron",
    icao_hex: ["A44329"],
    category: "corporate",
    description: "Chevron Corporation",
  },
  {
    name: "ExxonMobil",
    icao_hex: ["A08C40"],
    category: "corporate",
    description: "ExxonMobil corporate",
  },
  {
    name: "ConocoPhillips",
    icao_hex: ["A9C75B"],
    category: "corporate",
    description: "ConocoPhillips",
  },
  {
    name: "McDonald's",
    icao_hex: ["A77401"],
    category: "corporate",
    description: "McDonald's corporate",
  },
  {
    name: "Pepsi",
    icao_hex: ["A38C4A"],
    category: "corporate",
    description: "PepsiCo",
  },
  {
    name: "Costco",
    icao_hex: ["A10D7A"],
    category: "corporate",
    description: "Costco Wholesale",
  },
  {
    name: "Kroger",
    icao_hex: ["A49A01"],
    category: "corporate",
    description: "Kroger Company",
  },
  {
    name: "Dollar General",
    icao_hex: ["A9E89C"],
    category: "corporate",
    description: "Dollar General Corp",
  },

  // ─── Government / Political ───
  {
    name: "Donald Trump",
    icao_hex: ["A02EC6", "AA3410"],
    category: "government",
    description: "Former/current President",
  },
  {
    name: "U.S. Marshals (JPATS)",
    icao_hex: ["AE0000", "AE1491", "AE1492"],
    category: "government",
    description: "Justice Prisoner and Alien Transport System",
  },
  {
    name: "FBI",
    icao_hex: ["AE4AE7", "AE4AE8", "AE4AE9", "AE4AEA"],
    category: "government",
    description: "Federal Bureau of Investigation",
  },
  {
    name: "DOJ",
    icao_hex: ["AE4AD1", "AE4AD2"],
    category: "government",
    description: "Department of Justice",
  },
  {
    name: "DHS",
    icao_hex: ["AE4B27", "AE4B28", "AE4B29"],
    category: "government",
    description: "Department of Homeland Security",
  },
  {
    name: "FAA",
    icao_hex: ["A00001", "A00002", "A00003"],
    category: "government",
    description: "Federal Aviation Administration",
  },
  {
    name: "NASA",
    icao_hex: ["A05D41", "AE01C5", "AE01C6"],
    category: "government",
    description: "National Aeronautics and Space Administration",
  },
  {
    name: "Government of UK",
    icao_hex: ["43C6E4", "43C6E5"],
    category: "government",
    description: "UK Royal Air Force VIP fleet",
  },
  {
    name: "Government of France",
    icao_hex: ["3B7777", "3B7778"],
    category: "government",
    description: "French government fleet",
  },
  {
    name: "Government of Germany",
    icao_hex: ["3C4B25", "3C4B26"],
    category: "government",
    description: "German government fleet (Flugbereitschaft)",
  },
  {
    name: "Government of Japan",
    icao_hex: ["86D1CB", "86D1CC"],
    category: "government",
    description: "Japanese government fleet",
  },
  {
    name: "Government of Canada",
    icao_hex: ["C0448B", "C0448C"],
    category: "government",
    description: "Canadian government fleet",
  },
  {
    name: "Government of Brazil",
    icao_hex: ["E40154", "E40155"],
    category: "government",
    description: "Brazilian government fleet",
  },
  {
    name: "Government of India",
    icao_hex: ["800101", "800102"],
    category: "government",
    description: "Indian government fleet",
  },
  {
    name: "Government of Saudi Arabia",
    icao_hex: ["710260", "710261"],
    category: "government",
    description: "Saudi Royal Flight",
  },
  {
    name: "Government of Qatar",
    icao_hex: ["06A1A4", "06A1A5"],
    category: "government",
    description: "Qatari Amiri Flight",
  },
  {
    name: "Government of UAE",
    icao_hex: ["896051", "896052"],
    category: "government",
    description: "UAE Presidential Flight",
  },
  {
    name: "Government of Turkey",
    icao_hex: ["4B8200", "4B8201"],
    category: "government",
    description: "Turkish government fleet",
  },
  {
    name: "Government of Israel",
    icao_hex: ["738065", "738066"],
    category: "government",
    description: "Israeli Air Force VIP",
  },
  {
    name: "Government of South Korea",
    icao_hex: ["71BE00", "71BE01"],
    category: "government",
    description: "South Korean government fleet",
  },
  {
    name: "Government of Mexico",
    icao_hex: ["0D0413", "0D0414"],
    category: "government",
    description: "Mexican government fleet",
  },

  // ─── Media ───
  {
    name: "Rupert Murdoch",
    icao_hex: ["A62E87", "A3BC52"],
    category: "media",
    description: "News Corp / Fox",
  },
  {
    name: "David Ellison",
    icao_hex: ["A7EC65"],
    category: "media",
    description: "Skydance Media",
  },
  {
    name: "Mark Burnett",
    icao_hex: ["A6B191"],
    category: "media",
    description: "TV producer (Survivor, The Voice)",
  },
  {
    name: "Ted Turner",
    icao_hex: ["A1583B"],
    category: "media",
    description: "CNN founder / media mogul",
  },
  {
    name: "Jay Penske",
    icao_hex: ["A9C412"],
    category: "media",
    description: "Penske Media (Variety, Rolling Stone)",
  },

  // ─── Military / Special ───
  {
    name: "B-52 Stratofortress",
    icao_hex: ["AE0540", "AE0541", "AE0542"],
    category: "military",
    description: "USAF strategic bomber",
  },
  {
    name: "B-1B Lancer",
    icao_hex: ["AE0480", "AE0481", "AE0482"],
    category: "military",
    description: "USAF supersonic bomber",
  },
  {
    name: "RQ-4 Global Hawk",
    icao_hex: ["AE6011", "AE6012", "AE6013"],
    category: "military",
    description: "USAF surveillance UAV",
  },
  {
    name: "RC-135 Rivet Joint",
    icao_hex: ["AE01CE", "AE01CF", "AE01D0"],
    category: "military",
    description: "USAF reconnaissance",
  },
  {
    name: "WC-135 Constant Phoenix",
    icao_hex: ["AE01D5", "AE01D6"],
    category: "military",
    description: "USAF nuclear detection",
  },
  {
    name: "U-2 Dragon Lady",
    icao_hex: ["AE0412", "AE0413"],
    category: "military",
    description: "USAF high-altitude reconnaissance",
  },
  {
    name: "E-3 Sentry AWACS",
    icao_hex: ["AE0190", "AE0191", "AE0192"],
    category: "military",
    description: "USAF airborne warning and control",
  },
  {
    name: "P-8 Poseidon",
    icao_hex: ["AE68A0", "AE68A1", "AE68A2"],
    category: "military",
    description: "USN maritime patrol",
  },
  {
    name: "KC-135 Stratotanker",
    icao_hex: ["AE0210", "AE0211", "AE0212"],
    category: "military",
    description: "USAF aerial refueling tanker",
  },
  {
    name: "C-17 Globemaster III",
    icao_hex: ["AE0410", "AE0411"],
    category: "military",
    description: "USAF strategic airlift",
  },
  {
    name: "C-5 Galaxy",
    icao_hex: ["AE0100", "AE0101", "AE0102"],
    category: "military",
    description: "USAF heavy airlift",
  },
  {
    name: "USCG (Coast Guard)",
    icao_hex: ["AE4E30", "AE4E31", "AE4E32"],
    category: "military",
    description: "US Coast Guard fleet",
  },

  // ─── Aviation / YouTube ───
  {
    name: "Mike Patey",
    icao_hex: ["A10F90"],
    category: "aviation",
    description: "Aviation YouTuber / Scrappy builder",
  },
  {
    name: "steveo1kinevo",
    icao_hex: ["A67E4F"],
    category: "aviation",
    description: "Aviation YouTuber",
  },
  {
    name: "Premier1Driver",
    icao_hex: ["A5D2F3"],
    category: "aviation",
    description: "Aviation YouTuber",
  },
  {
    name: "Trent Palmer",
    icao_hex: ["A06E42"],
    category: "aviation",
    description: "Aviation YouTuber / bush pilot",
  },
  {
    name: "Matt Guthmiller",
    icao_hex: ["A15B2F"],
    category: "aviation",
    description: "Youngest solo circumnavigator",
  },
  {
    name: "Angle of Attack",
    icao_hex: ["A2B56C"],
    category: "aviation",
    description: "Aviation YouTuber",
  },
  {
    name: "CitationMax",
    icao_hex: ["A1F80E"],
    category: "aviation",
    description: "Aviation YouTuber",
  },

  // ─── More Billionaires / Corporate ───
  {
    name: "DeVos Family",
    icao_hex: ["A42701", "A31E8A"],
    category: "billionaire",
    description: "Amway / Orlando Magic",
  },
  {
    name: "Laurene Powell Jobs",
    icao_hex: ["A5E271"],
    category: "billionaire",
    description: "Emerson Collective / Steve Jobs widow",
  },
  {
    name: "Melinda Gates",
    icao_hex: ["A3CD01"],
    category: "billionaire",
    description: "Philanthropist",
  },
  {
    name: "James Dyson",
    icao_hex: ["406FAE"],
    category: "billionaire",
    description: "Dyson founder",
  },
  {
    name: "Roman Abramovich",
    icao_hex: ["424578", "424579"],
    category: "billionaire",
    description: "Russian oligarch",
  },
  {
    name: "Fred Luddy",
    icao_hex: ["A2E1BC"],
    category: "billionaire",
    description: "ServiceNow founder",
  },
  {
    name: "Erik Prince",
    icao_hex: ["A29D37"],
    category: "billionaire",
    description: "Blackwater/Academi founder",
  },
  {
    name: "Jared Kushner",
    icao_hex: ["A1C1A1"],
    category: "government",
    description: "Former Senior Advisor to the President",
  },
  {
    name: "Steve Witkoff",
    icao_hex: ["A0B771"],
    category: "billionaire",
    description: "Witkoff Group real estate",
  },
  {
    name: "SpaceX",
    icao_hex: ["A9B3C4", "A8C2E6"],
    category: "corporate",
    description: "SpaceX corporate fleet",
  },
  {
    name: "Palantir",
    icao_hex: ["A40B21"],
    category: "corporate",
    description: "Palantir Technologies",
  },
  {
    name: "Netflix",
    icao_hex: ["A7D3E1"],
    category: "corporate",
    description: "Netflix corporate",
  },
  {
    name: "Samsung",
    icao_hex: ["71BD44"],
    category: "corporate",
    description: "Samsung Group",
  },
  {
    name: "Marriott Hotels",
    icao_hex: ["A8B5F5"],
    category: "corporate",
    description: "Marriott International",
  },
  {
    name: "Hilton Hotels",
    icao_hex: ["AB78E2"],
    category: "corporate",
    description: "Hilton Worldwide",
  },
  {
    name: "Bass Pro Shops",
    icao_hex: ["A389C4"],
    category: "corporate",
    description: "Bass Pro Shops / Johnny Morris",
  },
  {
    name: "Enterprise",
    icao_hex: ["A65FE3"],
    category: "corporate",
    description: "Enterprise Holdings",
  },
  {
    name: "WWE",
    icao_hex: ["A51AC2"],
    category: "corporate",
    description: "World Wrestling Entertainment",
  },
  {
    name: "Playboy",
    icao_hex: ["A91D42"],
    category: "corporate",
    description: "Playboy Enterprises",
  },
];

// ── Build lookup index ──────────────────────────────────────────────────────

const _icaoIndex: Map<string, TrackedOperator | PotusAircraft> = new Map();

function buildIndex() {
  for (const op of TRACKED_OPERATORS) {
    for (const hex of op.icao_hex) {
      _icaoIndex.set(hex.toUpperCase(), op);
    }
  }
  for (const ac of POTUS_FLEET) {
    for (const hex of ac.icao_hex) {
      _icaoIndex.set(hex.toUpperCase(), ac);
    }
  }
}

buildIndex();

/**
 * Look up an operator or POTUS aircraft by ICAO hex code.
 * Returns the matching TrackedOperator or PotusAircraft, or undefined if not found.
 */
export function lookupIcaoHex(hex: string): TrackedOperator | PotusAircraft | undefined {
  return _icaoIndex.get(hex.toUpperCase());
}
