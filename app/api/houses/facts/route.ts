import { dataErrorResponse, mapFacts, mapSchools } from "@/lib/data";
import { boardContext } from "@/lib/tenancy";
import { pullListing, findSchools } from "@/lib/listing";
import { decorateSchools, packSchools, usableSchoolName } from "@/lib/schools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function missingFacts(facts) {
  return (
    facts.beds == null ||
    facts.baths == null ||
    facts.sqft == null ||
    facts.dom == null ||
    !facts.community ||
    (facts.lotSqft == null && facts.lotAcres == null)
  );
}

function missingSchools(schools) {
  return !usableSchoolName(schools.elementary) || !usableSchoolName(schools.middle) || !usableSchoolName(schools.high);
}

function fillFacts(current, incoming) {
  const next = { ...current };
  for (const key of ["beds", "baths", "sqft", "lotSqft", "lotAcres", "dom", "community"]) {
    const value = incoming?.[key];
    if (next[key] == null || next[key] === "") {
      if (value != null && value !== "") next[key] = value;
    }
  }
  return next;
}

function fillSchools(current, incoming) {
  const next = packSchools(current);
  const extra = packSchools(incoming);
  for (const key of ["elementary", "middle", "high"]) {
    if (usableSchoolName(next[key])) continue;
    if (usableSchoolName(extra[key])) next[key] = extra[key];
  }
  return next;
}

export async function POST(request: Request) {
  try {
    const { store } = await boardContext(request);
    const houses = await store.houses.listFactSources();
    const pending = houses.filter((house) => {
      const facts = mapFacts(house.facts);
      const schools = mapSchools(house.schools);
      return missingFacts(facts) || missingSchools(schools);
    });
    const batch = pending.slice(0, 3);
    const updated: any[] = [];

    for (const house of batch) {
      const currentFacts = mapFacts(house.facts);
      const currentSchools = mapSchools(house.schools);
      let nextFacts = currentFacts;
      let nextSchools = currentSchools;
      try {
        if (house.url) {
          const listing = await pullListing(house.url, { addressHint: house.name });
          nextFacts = fillFacts(nextFacts, listing.facts);
          nextSchools = fillSchools(nextSchools, listing.schools);
        }
        if (missingSchools(nextSchools) && house.name) {
          nextSchools = fillSchools(nextSchools, await findSchools(house.name));
        }
        if (missingSchools(nextSchools) && nextFacts.community) {
          const neighbor = await store.houses.findNeighborSchools(house.id, nextFacts.community);
          if (neighbor) nextSchools = fillSchools(nextSchools, neighbor);
        }
        if (
          ["elementary", "middle", "high"].some(
            (key) => usableSchoolName(nextSchools[key]) && nextSchools[key].rating == null
          )
        ) {
          nextSchools = await decorateSchools(nextSchools, house.name || "");
        }
      } catch {
        await store.houses.touch(house.id);
        continue;
      }

      const factsChanged = JSON.stringify(nextFacts) !== JSON.stringify(currentFacts);
      const schoolsChanged = JSON.stringify(nextSchools) !== JSON.stringify(currentSchools);
      if (!factsChanged && !schoolsChanged) {
        await store.houses.touch(house.id);
        continue;
      }
      const next = await store.houses.updateFactsAndSchools(house.id, nextFacts, nextSchools);
      if (next) updated.push(next);
    }

    const leftover = (await store.houses.listAllFactSources()).filter((house) => {
      const facts = mapFacts(house.facts);
      const schools = mapSchools(house.schools);
      return missingFacts(facts) || missingSchools(schools);
    });
    return Response.json({
      updated,
      remaining: leftover.length,
    });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
