import { blake2AsU8a, encodeAddress } from "@polkadot/util-crypto";
import type { Proposal, ProposalStatus, VendorInfo, VendorUpdate } from "@/lib/types";
import type { VendorCategory } from "@/lib/vendorCategories";

/** Deterministic, validly-encoded (but unowned) SS58 address for a given demo identity. */
function demoAddress(seed: string): string {
  return encodeAddress(blake2AsU8a(seed, 256), 42);
}

export const DEMO_CITIZEN = {
  address: demoAddress("vendor-dao-demo-citizen"),
  name: "Detroit Resident (Demo)",
};

export const DEMO_ADMIN = {
  address: demoAddress("vendor-dao-demo-city-admin"),
  name: "City of Detroit (Demo Admin)",
};

const DEMO_UNIT = 1_000_000_000_000n; // matches CHAIN_DECIMALS = 12

function units(wholeTokens: number): string {
  return (BigInt(wholeTokens) * DEMO_UNIT).toString();
}

interface DemoVendorSeed {
  key: string;
  name: string;
  category: VendorCategory;
  description: string;
  contact: string;
  businessAddress: string;
  website: string;
  verified: boolean;
  registeredAt: number;
}

const VENDOR_SEEDS: DemoVendorSeed[] = [
  {
    key: "motor-city-restoration",
    name: "Motor City Restoration Co.",
    category: "Construction",
    description:
      "General contractor specializing in historic building rehabilitation and recreation facility renovations across Detroit.",
    contact: "contact@motorcityrestoration.example",
    businessAddress: "4501 Woodward Ave, Detroit, MI 48201",
    website: "https://motorcityrestoration.example",
    verified: true,
    registeredAt: 1200,
  },
  {
    key: "eastern-market-growers",
    name: "Eastern Market Growers Collective",
    category: "FoodAndAgriculture",
    description:
      "Cooperative of 60+ urban farms supplying Eastern Market, focused on cold-chain logistics and food access.",
    contact: "info@easternmarketgrowers.example",
    businessAddress: "2934 Russell St, Detroit, MI 48207",
    website: "https://easternmarketgrowers.example",
    verified: true,
    registeredAt: 1450,
  },
  {
    key: "detroit-blight-busters",
    name: "Detroit Blight Busters",
    category: "Environmental",
    description:
      "Nonprofit crew clearing vacant lots and converting them into maintained green space and community gardens.",
    contact: "hello@blightbusters.example",
    businessAddress: "13801 Fenkell Ave, Detroit, MI 48227",
    website: "https://blightbusters.example",
    verified: true,
    registeredAt: 900,
  },
  {
    key: "corktown-community-builders",
    name: "Corktown Community Builders",
    category: "Housing",
    description:
      "Affordable-housing developer rehabilitating vacant historic rowhouses for returning Detroit residents.",
    contact: "leasing@corktownbuilders.example",
    businessAddress: "1730 Bagley St, Detroit, MI 48216",
    website: "https://corktownbuilders.example",
    verified: true,
    registeredAt: 2100,
  },
  {
    key: "belle-isle-conservancy",
    name: "Belle Isle Conservancy Partners",
    category: "ParksAndRecreation",
    description:
      "Stewards of Belle Isle Park's historic structures, gardens, and the Anna Scripps Whitcomb Conservatory.",
    contact: "partners@belleisleconservancy.example",
    businessAddress: "900 Inselruhe Ave, Belle Isle, Detroit, MI 48207",
    website: "https://belleisleconservancy.example",
    verified: true,
    registeredAt: 800,
  },
  {
    key: "north-end-youth-arts",
    name: "North End Youth Arts Alliance",
    category: "ArtsAndCulture",
    description:
      "Pairs local teens with professional muralists and musicians for citywide public-art and youth programming.",
    contact: "studio@northendyoutharts.example",
    businessAddress: "9227 Woodward Ave, Detroit, MI 48202",
    website: "https://northendyoutharts.example",
    verified: false,
    registeredAt: 3400,
  },
  {
    key: "riverwalk-green-infra",
    name: "Riverwalk Green Infrastructure LLC",
    category: "Infrastructure",
    description:
      "Designs and builds protected bike lanes, solar lighting, and green stormwater infrastructure along the riverfront.",
    contact: "projects@riverwalkgreeninfra.example",
    businessAddress: "1340 Atwater St, Detroit, MI 48207",
    website: "https://riverwalkgreeninfra.example",
    verified: false,
    registeredAt: 3900,
  },
];

export function vendorAddress(key: string): string {
  return demoAddress(key);
}

interface DemoProposalSeed {
  title: string;
  description: string;
  vendorKey: string;
  amount: number;
  status: ProposalStatus;
  ayes: number;
  nays: number;
  createdAt: number;
  votingEnd: number;
}

const PROPOSAL_SEEDS: DemoProposalSeed[] = [
  {
    title: "Belle Isle Conservatory Glass Roof Restoration",
    description:
      "Full restoration of the historic Anna Scripps Whitcomb Conservatory's glass dome and roof structure, addressing decades of weather damage and improving climate control for the botanical collection.",
    vendorKey: "belle-isle-conservancy",
    amount: 185000,
    status: "Funded",
    ayes: 412,
    nays: 37,
    createdAt: 8100,
    votingEnd: 22500,
  },
  {
    title: "Vacant Lot Greening — North End Corridor",
    description:
      "Conversion of 24 vacant lots along the North End corridor into maintained green space, community gardens, and pollinator habitat, reducing blight and improving neighborhood safety.",
    vendorKey: "detroit-blight-busters",
    amount: 62000,
    status: "Funded",
    ayes: 298,
    nays: 21,
    createdAt: 9500,
    votingEnd: 23900,
  },
  {
    title: "Grand River Ave Protected Bike Lanes",
    description:
      "Installation of 3.2 miles of physically-protected bike lanes along Grand River Avenue between Downtown and the New Center area, including signal upgrades at 9 intersections.",
    vendorKey: "riverwalk-green-infra",
    amount: 240000,
    status: "Approved",
    ayes: 356,
    nays: 118,
    createdAt: 15200,
    votingEnd: 29600,
  },
  {
    title: "Eastern Market Cold-Storage Co-op Expansion",
    description:
      "Expansion of shared cold-storage facilities at Eastern Market to support small urban farms and reduce post-harvest food loss for over 60 local growers.",
    vendorKey: "eastern-market-growers",
    amount: 94000,
    status: "Proposed",
    ayes: 187,
    nays: 42,
    createdAt: 24800,
    votingEnd: 39200,
  },
  {
    title: "Corktown Rowhouse Rehab — Phase 2",
    description:
      "Rehabilitation of 12 vacant historic rowhouses on Bagley Street into affordable housing units for returning residents, preserving Corktown's 19th-century architectural character.",
    vendorKey: "corktown-community-builders",
    amount: 310000,
    status: "Proposed",
    ayes: 201,
    nays: 76,
    createdAt: 25100,
    votingEnd: 39500,
  },
  {
    title: "Chandler Park Recreation Center Renovation",
    description:
      "Full interior renovation of the Chandler Park Recreation Center, including a new gymnasium floor, updated HVAC, and an accessible entrance ramp.",
    vendorKey: "motor-city-restoration",
    amount: 150000,
    status: "Rejected",
    ayes: 88,
    nays: 214,
    createdAt: 11300,
    votingEnd: 25700,
  },
  {
    title: "Youth Mural Arts Program — Grand Boulevard",
    description:
      "A citywide youth mural program pairing local teens with professional artists to paint 15 murals celebrating Detroit's music and labor history along Grand Boulevard.",
    vendorKey: "north-end-youth-arts",
    amount: 38000,
    status: "Proposed",
    ayes: 264,
    nays: 19,
    createdAt: 26000,
    votingEnd: 40400,
  },
  {
    title: "Riverfront Solar Lighting Initiative",
    description:
      "Solar-powered pedestrian lighting along a half-mile stretch of the Detroit Riverwalk to improve evening safety and reduce grid electricity costs.",
    vendorKey: "riverwalk-green-infra",
    amount: 76000,
    status: "Cancelled",
    ayes: 12,
    nays: 3,
    createdAt: 12800,
    votingEnd: 27200,
  },
];

export function createDemoVendors(): VendorInfo[] {
  return VENDOR_SEEDS.map((seed) => {
    const funded = PROPOSAL_SEEDS.filter((p) => p.vendorKey === seed.key && p.status === "Funded");
    return {
      address: demoAddress(seed.key),
      name: seed.name,
      category: seed.category,
      description: seed.description,
      contact: seed.contact,
      businessAddress: seed.businessAddress,
      website: seed.website,
      verified: seed.verified,
      registeredAt: seed.registeredAt,
      totalReceived: units(funded.reduce((sum, p) => sum + p.amount, 0)),
      proposalsFunded: funded.length,
    };
  });
}

export function createDemoProposals(): Proposal[] {
  return PROPOSAL_SEEDS.map((seed, index) => ({
    id: index,
    proposer: DEMO_CITIZEN.address,
    vendor: vendorAddress(seed.vendorKey),
    title: seed.title,
    description: seed.description,
    amount: units(seed.amount),
    status: seed.status,
    ayes: seed.ayes,
    nays: seed.nays,
    createdAt: seed.createdAt,
    votingEnd: seed.votingEnd,
  }));
}

export function createDemoTreasury() {
  const totalDisbursed = PROPOSAL_SEEDS.filter((p) => p.status === "Funded").reduce(
    (sum, p) => sum + p.amount,
    0,
  );
  const stillInPot = 420000;
  return {
    potAddress: demoAddress("vendor-dao-treasury-pot"),
    potBalance: units(stillInPot),
    totalReceived: units(totalDisbursed + stillInPot),
    totalDisbursed: units(totalDisbursed),
  };
}

export interface TreasuryContribution {
  block: number;
  amount: string;
  from: string;
  source: string;
}

const CONTRIBUTION_SEEDS = [
  { source: "City of Detroit FY26 Community Investment Allocation", amount: 500000, block: 500 },
  { source: "Kresge Foundation Matching Grant", amount: 100000, block: 2000 },
  { source: "Community Crowdfunding Drive", amount: 45000, block: 5000 },
  { source: "Local Business Coalition Contribution", amount: 22000, block: 7000 },
];

export function createDemoTreasuryContributions(): TreasuryContribution[] {
  return CONTRIBUTION_SEEDS.map((seed) => ({
    block: seed.block,
    amount: units(seed.amount),
    from: DEMO_ADMIN.address,
    source: seed.source,
  }));
}

interface DemoVendorUpdateSeed {
  vendorKey: string;
  content: string;
  /** Index into PROPOSAL_SEEDS (becomes the proposal's id), or null for a general update. */
  proposalIndex: number | null;
  postedAt: number;
}

const VENDOR_UPDATE_SEEDS: DemoVendorUpdateSeed[] = [
  {
    vendorKey: "belle-isle-conservancy",
    content:
      "Work has begun on the Conservatory glass dome — scaffolding is up and the first panes are being carefully removed for restoration.",
    proposalIndex: 0,
    postedAt: 22800,
  },
  {
    vendorKey: "belle-isle-conservancy",
    content:
      "All 216 panes have now been replaced with historically accurate hand-blown glass. The Conservatory reopens to the public next month — thank you, Detroit!",
    proposalIndex: 0,
    postedAt: 27600,
  },
  {
    vendorKey: "detroit-blight-busters",
    content:
      "18 of 24 vacant lots along the North End corridor have been cleared and are being prepped for spring planting. Thank you to the 40+ neighborhood volunteers who joined us this month.",
    proposalIndex: 1,
    postedAt: 24200,
  },
  {
    vendorKey: "riverwalk-green-infra",
    content:
      "Great news — the signal upgrade design for Grand River Ave has been approved by the city traffic engineering office. Construction on the first 1.2 miles of protected lane begins in three weeks.",
    proposalIndex: 2,
    postedAt: 30100,
  },
  {
    vendorKey: "motor-city-restoration",
    content:
      "Proud to share we've completed 8 city rehabilitation projects since 2019, from recreation centers to historic facades. Excited for what's next!",
    proposalIndex: null,
    postedAt: 26400,
  },
  {
    vendorKey: "eastern-market-growers",
    content:
      "Over 60 local growers turned out for our community info session on the Cold-Storage Co-op expansion — thank you for the great questions and support!",
    proposalIndex: 3,
    postedAt: 26200,
  },
  {
    vendorKey: "eastern-market-growers",
    content:
      "Now supplying fresh produce to 12 Detroit Public Schools through our grower cooperative, up from 5 last year. Excited to keep growing food access citywide.",
    proposalIndex: null,
    postedAt: 31400,
  },
  {
    vendorKey: "corktown-community-builders",
    content:
      "Structural assessments are complete on all 12 Bagley Street rowhouses. Historic preservation review begins next week.",
    proposalIndex: 4,
    postedAt: 27100,
  },
  {
    vendorKey: "corktown-community-builders",
    content:
      "Phase 1 of our rowhouse rehab program housed 8 returning Detroit families last year. Grateful for this community's continued trust as we start Phase 2.",
    proposalIndex: null,
    postedAt: 32600,
  },
  {
    vendorKey: "north-end-youth-arts",
    content:
      "42 teens have signed up for this summer's Grand Boulevard mural program! Auditions for lead muralist mentors close Friday.",
    proposalIndex: 6,
    postedAt: 28300,
  },
  {
    vendorKey: "north-end-youth-arts",
    content:
      "Congrats to our 2025 cohort — 15 murals completed across the North End this year, all designed and painted by local teens.",
    proposalIndex: null,
    postedAt: 33900,
  },
  {
    vendorKey: "detroit-blight-busters",
    content:
      "All 24 vacant lots along the North End corridor are now cleared, planted, and community-maintained. Final report and photos posted to our site — thank you, Detroit!",
    proposalIndex: 1,
    postedAt: 29500,
  },
];

export function createDemoVendorUpdates(): VendorUpdate[] {
  return VENDOR_UPDATE_SEEDS.map((seed, index) => ({
    id: index,
    vendor: vendorAddress(seed.vendorKey),
    content: seed.content,
    proposalId: seed.proposalIndex,
    postedAt: seed.postedAt,
  }));
}

/** Minimum total votes for a demo proposal to be actionable — mirrors the chain's quorum concept. */
export const DEMO_MINIMUM_QUORUM = 150;
