/**
 * The Giga Maps country exports in /public/country-maps: every school in the
 * country as a dot, green where it reports connectivity. One per country Giga
 * works in.
 *
 * `slug` is the file name. Generated from the raw exports by
 * tools/prepare-country-maps.py — re-run it when new countries arrive and keep
 * this list in step. Thumbnails for the picker live in country-maps/thumbs.
 */
export interface CountryMap {
  name: string;
  slug: string;
}

export const COUNTRY_MAPS: CountryMap[] = [
  { name: "Anguilla", slug: "anguilla" },
  { name: "Antigua and Barbuda", slug: "antigua-and-barbuda" },
  { name: "Barbados", slug: "barbados" },
  { name: "Belize", slug: "belize" },
  { name: "Benin", slug: "benin" },
  { name: "Bosnia and Herzegovina", slug: "bosnia-and-herzegovina" },
  { name: "Botswana", slug: "botswana" },
  { name: "Brazil", slug: "brazil" },
  { name: "British Virgin Islands", slug: "british-virgin-islands" },
  { name: "Cambodia", slug: "cambodia" },
  { name: "Djibouti", slug: "djibouti" },
  { name: "Dominica", slug: "dominica" },
  { name: "Dominican Republic", slug: "dominican-republic" },
  { name: "El Salvador", slug: "el-salvador" },
  { name: "Eswatini", slug: "eswatini" },
  { name: "Ethiopia", slug: "ethiopia" },
  { name: "Fiji", slug: "fiji" },
  { name: "Gambia", slug: "gambia" },
  { name: "Ghana", slug: "ghana" },
  { name: "Grenada", slug: "grenada" },
  { name: "Guatemala", slug: "guatemala" },
  { name: "Guinea", slug: "guinea" },
  { name: "Honduras", slug: "honduras" },
  { name: "Kazakhstan", slug: "kazakhstan" },
  { name: "Kenya", slug: "kenya" },
  { name: "Kyrgyzstan", slug: "kyrgyzstan" },
  { name: "Lesotho", slug: "lesotho" },
  { name: "Liberia", slug: "liberia" },
  { name: "Malawi", slug: "malawi" },
  { name: "Mexico", slug: "mexico" },
  { name: "Moldova", slug: "moldova" },
  { name: "Mongolia", slug: "mongolia" },
  { name: "Montenegro", slug: "montenegro" },
  { name: "Montserrat", slug: "montserrat" },
  { name: "Mozambique", slug: "mozambique" },
  { name: "Namibia", slug: "namibia" },
  { name: "Niger", slug: "niger" },
  { name: "Panama", slug: "panama" },
  { name: "Rwanda", slug: "rwanda" },
  { name: "Saint Kitts and Nevis", slug: "saint-kitts-and-nevis" },
  { name: "Saint Lucia", slug: "saint-lucia" },
  { name: "Saint Vincent and the Grenadines", slug: "saint-vincent-and-the-grenadines" },
  { name: "Sao Tome and Principe", slug: "sao-tome-and-principe" },
  { name: "Senegal", slug: "senegal" },
  { name: "Sierra Leone", slug: "sierra-leone" },
  { name: "South Africa", slug: "south-africa" },
  { name: "Sri Lanka", slug: "sri-lanka" },
  { name: "Tajikistan", slug: "tajikistan" },
  { name: "Tanzania", slug: "tanzania" },
  { name: "Trinidad and Tobago", slug: "trinidad-and-tobago" },
  { name: "Turks and Caicos", slug: "turks-and-caicos" },
  { name: "Uzbekistan", slug: "uzbekistan" },
  { name: "Zambia", slug: "zambia" },
  { name: "Zimbabwe", slug: "zimbabwe" },
];

const BY_SLUG = new Map(COUNTRY_MAPS.map((c) => [c.slug, c]));

/** A slug we actually ship a file for. Guards untrusted input (deck files). */
export function isCountryMap(slug: unknown): slug is string {
  return typeof slug === "string" && BY_SLUG.has(slug);
}

export function countryMapName(slug: string): string {
  return BY_SLUG.get(slug)?.name ?? slug;
}

export const countryMapSrc = (slug: string) => `/country-maps/${slug}.jpg`;
export const countryMapThumb = (slug: string) => `/country-maps/thumbs/${slug}.jpg`;
