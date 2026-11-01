import { extractListingFacts, isChallengeHtml, listingFromCityPage, listingFromLongFoster, longFosterCityUrl } from "@/lib/listing";

describe("extractListingFacts tax", () => {
  it("uses the tax-history dollar amount instead of a property tax rate", () => {
    const html = `
      <script type="application/json">{"price":400000,"propertyTaxRate":0.5}</script>
      <div class="tax-history-data-year">2024</div>
      <div class="tax-history-data tax-history-data-tax">$5,400</div>
    `;
    expect(extractListingFacts(html, { price: 400000 }).taxMonthly).toBe(450);
  });

  it("leaves tax blank when the page only publishes a rate", () => {
    const html = `<script type="application/json">{"price":400000,"propertyTaxRate":0.5}</script>`;
    expect(extractListingFacts(html, { price: 400000 }).taxMonthly).toBeNull();
  });

  it("reads a labeled annual property tax as a monthly amount", () => {
    const html = `<dl><dt>Property taxes</dt><dd>$4,800</dd></dl>`;
    expect(extractListingFacts(html, { price: 400000 }).taxMonthly).toBe(400);
  });

  it("reads Long and Foster tax, HOA, and schools", () => {
    const html = `
      Association Fee : $149.95 Association Fee Frequency : Monthly
      Tax Annual Amount : $7,722.00
      Elementary School : FLORIS Middle Or Junior School : CARSON High School : WESTFIELD Listing Information
      3 bedrooms, 4 full bathrooms, and 1 half bathroom. Sq. ft. 1,998 Lot 0.03 Acres
    `;
    const found = extractListingFacts(html, { price: 649000 });
    expect(found.taxMonthly).toBe(643.5);
    expect(found.hoa).toBe(149.95);
    expect(found.facts.beds).toBe(3);
    expect(found.facts.baths).toBe(4.5);
    expect(found.facts.sqft).toBe(1998);
    expect(found.schools.elementary).toBe("Floris Elementary");
    expect(found.schools.middle).toBe("Carson Middle");
    expect(found.schools.high).toBe("Westfield High");
  });

  it("keeps a monthly HOA when the page repeats the same fee", () => {
    const html = `
      <strong>HOA FEE: </strong>$75/month
      <strong>Association Fee: </strong>$75
      <strong>Tax Amount: </strong>$6,571
      <div class="tax-history-data-year">2024</div>
      <div class="tax-history-data tax-history-data-tax">$5,988</div>
    `;
    const found = extractListingFacts(html, { address: "15422 Silvan Glen Dr, Dumfries, VA", price: 799900 });
    expect(found.hoa).toBe(75);
    expect(found.taxMonthly).toBe(547.58);
  });

  it("does not copy price or HOA from a different street", () => {
    const html = `
      <meta property="og:title" content="10 Main St, Stafford, VA 22554" />
      <script type="application/json">{"price":475000,"monthlyHoaDues":14514.5}</script>
    `;
    const found = extractListingFacts(html, { address: "35 Elm St, Stafford, VA", price: 0 });
    expect(found.price).toBe(0);
    expect(found.hoa).toBeNull();
    expect(found.address).toBe("35 Elm St, Stafford, VA");
  });
});

describe("challenge pages", () => {
  it("keeps a Redfin listing that also includes the WAF cookie script", () => {
    const listing = `<title>53 Goodwin St</title><div>For sale $667,038</div>${" ".repeat(50000)}`;
    const withWaf = `<script>window.awsWafCookieDomainList = ["redfin.com"];</script>${listing}`;
    expect(isChallengeHtml(withWaf)).toBe(false);
    expect(isChallengeHtml(`<html>Just a moment... window.awsWafCookieDomainList = []</html>`)).toBe(true);
  });
});

describe("city page lookup", () => {
  it("requires the street name, not just a digit that appears in another link", () => {
    const html = `
      <a href="/va/stafford/123-main-st/pid_35/">wrong</a>
      <a href="/va/stafford/35-elm-st/pid_999/">right</a>
    `;
    expect(listingFromCityPage(html, "35 Elm St, Stafford, VA", "https://www.coldwellbankerhomes.com")).toBe(
      "https://www.coldwellbankerhomes.com/va/stafford/35-elm-st/pid_999/"
    );
    expect(
      listingFromCityPage(
        `<a href="/va/stafford/123-main-st/pid_35/">wrong</a>`,
        "35 Elm St, Stafford, VA",
        "https://www.coldwellbankerhomes.com"
      )
    ).toBe("");
  });
});

describe("long foster lookup", () => {
  it("builds a Virginia city search and finds the matching detail link", () => {
    expect(longFosterCityUrl("13937 Airfoil Road, Herndon, VA 20171")).toBe(
      "https://www.longandfoster.com/realestate/search/city/Herndon/VA"
    );
    expect(longFosterCityUrl("10 Main St, Charlotte, NC 28202")).toBe("");
    const html = `
      <a href="./details/10686341/12828-framingham-court-herndon-va-20171">other</a>
      <a href="./details/142819266/13937-airfoil-road-herndon-va-20171">match</a>
    `;
    expect(listingFromLongFoster(html, "13937 Airfoil Road, Herndon, VA 20171")).toBe(
      "https://www.longandfoster.com/realestate/details/142819266/13937-airfoil-road-herndon-va-20171"
    );
  });
});
