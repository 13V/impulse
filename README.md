# Impulse Automotive website demo

A React/Vite website adapted from the supplied reference website layout for Impulse Automotive in Elizabeth South, South Australia. The reference repository is unchanged.

The design follows the supplied dealership references: charcoal surfaces, yellow controls, wide geometric Michroma headings, a studio-car hero with working search, staggered service panels, compact inventory cards, a sell-your-car campaign banner and a rounded white footer. Stock and vehicle-detail pages use the same design language. Stock browsing, useful vehicle facts and direct showroom contact remain the main actions.

## Prestige benchmarks

Official sources were researched with Agent Reach on 12 October 2026:

- [Romans International](https://www.romansinternational.com/): collection browsing, clear vehicle facts, and distinct history/team content.
- [Tom Hartley](https://www.tomhartley.com/): one main inventory action, concise presentation and personal service information. Retrieved HTML and CSS also support its use of serif headings, black/white sections and generous spacing.
- [Lorbek Luxury Cars](https://www.lorbek.com.au/home): image-led arrivals, useful vehicle specifications, recent sales and showroom information.
- [Rolls-Royce Motor Cars](https://www.rolls-roycemotorcars.com/): short campaign headings, sparse discovery actions and thematic content sections.
- [Bentley Motors](https://www.bentleymotors.com/): consistent campaign imagery, concise propositions and prominent test-drive/dealer routes.

The original Impulse treatment applies those presentation principles to a small local showroom. Reader text, HTML and the available Tom Hartley stylesheet informed this research; current competitor screenshots were not available. Competitor logos, photographs, copy and proprietary styles are not included in the demo.

## Run locally

Requires Node.js 20.19 or later.

```sh
npm ci
npm run dev
```

The development server runs on port 5174 so it can run beside the reference website. The production preview uses port 4174.

```sh
npm run build
npm run preview
```

With the development server running, run the browser smoke checks with `npm test`. Set `IMPULSE_BASE_URL` if the server uses a different port, and `IMPULSE_CHROMIUM_PATH` to use a locally installed Chromium browser.

The app includes the home page, stock search and filters, sorting, saved vehicles, vehicle details and photo galleries, an illustrative repayment calculator, and an enquiry message builder. Saved vehicles stay in this browser. Enquiries open an SMS app when the visitor chooses to send; no lead is submitted by the website itself.

## Demo content

The hero uses the supplied showroom photograph, edited to replace the back-wall logo with the supplied black Impulse wordmark and enhance photographic clarity. It does not establish current vehicle availability. The white SUV cutout and silver supercar sell banner are generated illustrative campaign images, not photographs of Impulse stock or its showroom. The marque strip expresses the supplied visual reference and does not claim current brand availability. Michroma is bundled under the SIL Open Font License; marque SVGs from Simple Icons include their license, disclaimer and source details in `public/marques`. The dark location graphic is a schematic link to the business's Google Maps destination, rather than a navigational map.

Inventory, prices, specifications and generic vehicle photography are illustrative examples. Model descriptors match the visible BMW, Volkswagen and Mercedes-AMG photographs, while years, kilometres, prices and specifications remain sample data. Each gallery contains only available photographs relevant to that model; single-photo examples have no carousel controls. Repeated photographs demonstrate different listing states rather than separate verified vehicles. These are not live Impulse Automotive listings or evidence of actual sales. The demo labels these examples on the home, collection and vehicle pages. Replace all examples with approved business inventory and matching photography before launch.

The supplied Google Business Profile text provides the business name, 183 Philip Highway, Elizabeth South SA 5112 address, 0424 566 439 contact phone, family-owned description, and 4.6 rating from 41 reviews. The three short testimonial excerpts are attributed to Ben Easter, Nicholas Chapley and Daniel Law and reproduced from that supplied text. Verify business details and the current review count before launch.

Branding is informed by the supplied Facebook screenshots: black and white presentation, a serif “Impulse” wordmark with italic “Automotive,” and the tagline “For that something special.” The supplied [Facebook page](https://www.facebook.com/impulseautomotivesales/) is linked on the website. Agent Reach's follow-up reader request returned Facebook's login gate rather than business posts or photographs. Its Facebook browser backend requires a logged-in OpenCLI browser session that this machine does not have. The supplied screenshots remain the visual evidence for the business's branding.

This project contains only the public website. It has no CRM, stock manager, presentation, lead database or external service credentials.

## Hosting

Deploy the `dist` directory after building. Configure the host to serve `index.html` for browser routes such as `/stock` and `/stock/bmw-m4-coupe`. Vite's development and preview servers already support these routes. `vercel.json` includes this fallback for Vercel hosting; no deployment is performed by this project.
