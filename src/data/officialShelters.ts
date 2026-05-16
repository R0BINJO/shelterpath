/*
 * GENERATED / HARDCODED OFFICIAL SHELTER DATA SNAPSHOT
 *
 * SOURCE: Päästeamet avalikud varjumiskohad open data
 *   Page:  https://www.rescue.ee/et/juhend/avaandmed/avalikud-varjumiskohad
 *   CSV:   https://opendata.smit.ee/gis/varjumiskohad.csv
 *   GPKG:  https://opendata.smit.ee/gis/varjumiskohad.gpkg
 *
 * Snapshot imported on 2026-05-16. Do NOT edit individual coordinates manually
 * unless verifying against the official source. Refresh this file by rerunning
 * scripts/importOfficialShelters.ts.
 *
 * The CSV ships coordinates in L-EST97 / EPSG:3301 (Lambert Conformal Conic 2SP
 * on GRS-80). We bundle the raw projected coordinates AND the inverse-projection
 * math, run it ONCE at module-eval time, and freeze the resulting WGS84 array so
 * the rest of the app pays zero per-frame conversion cost.
 *
 * No network calls are made at runtime — this file is a fully bundled snapshot.
 *
 * PRODUCTION TODO: refresh officialShelters from source CSV/GPKG periodically.
 */

import type { LatLng } from '@/lib/routing';

export const shelterDataSource = {
  sourceName: 'Päästeamet avalikud varjumiskohad',
  sourcePageUrl:
    'https://www.rescue.ee/et/juhend/avaandmed/avalikud-varjumiskohad',
  csvUrl: 'https://opendata.smit.ee/gis/varjumiskohad.csv',
  gpkgUrl: 'https://opendata.smit.ee/gis/varjumiskohad.gpkg',
  importedAt: '2026-05-16',
  licenseNote: 'Päästeamet open data / Creative Commons 3.0 terms',
  snapshotNote:
    'Hardcoded dataset snapshot. Data may change on the official source.',
} as const;

export type OfficialShelter = {
  id: string;
  name: string;
  address: string;
  municipality: string;
  county: string;
  lat: number;
  lng: number;
  type: 'SA3';
  source: 'Päästeamet';
  official: true;
  verified: true;
  dataSnapshotDate: '2026-05-16';
  originalProperties: {
    id: string;
    nimi: string;
    aadress: string;
    lest_x: number;
    lest_y: number;
  };
};

/* -------------------------------------------------------------------------- */
/* Inverse Lambert Conformal Conic 2SP (EPSG:3301 → WGS84, GRS-80 ellipsoid)  */
/* -------------------------------------------------------------------------- */

// EPSG:3301 parameters
const LAT_1 = 59.33333333333334;
const LAT_2 = 58;
const LAT_0 = 57.51755393055556;
const LON_0 = 24;
const X_0 = 500000; // false easting
const Y_0 = 6375000; // false northing
// GRS-80
const A = 6378137.0;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const E = Math.sqrt(E2);

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function lccT(phi: number): number {
  const eSinPhi = E * Math.sin(phi);
  return (
    Math.tan(Math.PI / 4 - phi / 2) / Math.pow((1 - eSinPhi) / (1 + eSinPhi), E / 2)
  );
}

function lccM(phi: number): number {
  return Math.cos(phi) / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
}

const phi1 = LAT_1 * DEG;
const phi2 = LAT_2 * DEG;
const phi0 = LAT_0 * DEG;
const m1 = lccM(phi1);
const m2 = lccM(phi2);
const t1 = lccT(phi1);
const t2 = lccT(phi2);
const t0 = lccT(phi0);
const N = Math.log(m1 / m2) / Math.log(t1 / t2); // cone constant
const F_LCC = m1 / (N * Math.pow(t1, N));
const rho0 = A * F_LCC * Math.pow(t0, N);

/**
 * Invert L-EST97 (easting, northing) to WGS84 (lat, lng) in degrees.
 *
 * IMPORTANT: in the published CSV the column named `lest_x` holds the
 * NORTHING (Y, ~6.4M) and `lest_y` holds the EASTING (X, ~400K–740K).
 * This is how the official Estonian Land Board ships the dataset.
 */
function lest97ToWgs84(easting: number, northing: number): LatLng {
  const x = easting - X_0;
  const y = rho0 - (northing - Y_0);
  const rho = Math.sign(N) * Math.sqrt(x * x + y * y);
  const theta = Math.atan2(x, y);
  const t = Math.pow(rho / (A * F_LCC), 1 / N);

  // Series solution for phi from t (Snyder eq. 7-9)
  let phi = Math.PI / 2 - 2 * Math.atan(t);
  for (let i = 0; i < 8; i++) {
    const eSinPhi = E * Math.sin(phi);
    const next =
      Math.PI / 2 -
      2 * Math.atan(t * Math.pow((1 - eSinPhi) / (1 + eSinPhi), E / 2));
    if (Math.abs(next - phi) < 1e-11) {
      phi = next;
      break;
    }
    phi = next;
  }

  const lng = theta / N + LON_0 * DEG;
  return { lat: phi * RAD, lng: lng * RAD };
}

/* -------------------------------------------------------------------------- */
/* Raw snapshot (id, nimi, aadress, lest_x=northing, lest_y=easting)           */
/* -------------------------------------------------------------------------- */

type RawRow = readonly [
  id: string,
  nimi: string,
  aadress: string,
  lestX: number,
  lestY: number,
];

// Verbatim from https://opendata.smit.ee/gis/varjumiskohad.csv (2026-05-16).
const RAW_ROWS: readonly RawRow[] = [
  ['PÕ22219', 'Pirita Majandus-gümnaasium', 'Harju maakond, Tallinn, Pirita linnaosa, Metsavahi tee 19', 6592791.0, 547714.72],
  ['PÕ56747', 'Lasnamäe spordikompleks', 'Harju maakond, Tallinn, Lasnamäe linnaosa, Pae tn 1', 6587872.48, 545355.59],
  ['ID57831', 'polikliinik', 'Ida-Viru maakond, Narva linn, Vestervalli tn 15', 6589961.18, 738275.39],
  ['PÕ33432', 'Põhja Spordihoone', 'Harju maakond, Tallinn, Põhja-Tallinna linnaosa, Uus-Maleva tn 10', 6591158.06, 538885.94],
  ['LÕ41029', 'Valga Muusikakool', 'Valga maakond, Valga vald, Valga linn, Kesk tn 22', 6405765.52, 620834.2],
  ['LÕ76553', 'Jõgeva kaubahall', 'Jõgeva maakond, Jõgeva vald, Jõgeva linn, Aia tn 3', 6514373.39, 638679.29],
  ['LÕ44805', 'Jõgeva Vallavalitsus', 'Jõgeva maakond, Jõgeva vald, Jõgeva linn, Suur tn 5', 6514294.64, 638731.8],
  ['LÕ94587', 'TÜ füüsika instituudi õppehoone', 'Tartu maakond, Tartu linn, Tartu linn, W. Ostwaldi tn 1', 6472687.42, 657416.78],
  ['PÕ48530', 'Kultuurikeskus Kaja/ Mustame LOV', 'Harju maakond, Tallinn, Mustamäe linnaosa, E. Vilde tee 118', 6585321.27, 537844.78],
  ['LÕ45326', 'Valgjärve külamaja', 'Põlva maakond, Kanepi vald, Valgjärve küla, Järve tee 4', 6441532.78, 656395.14],
  ['LÕ45327', 'Kanepi Gümnaasium', 'Põlva maakond, Kanepi vald, Kanepi alevik, Kooli tn 1', 6430621.28, 663218.02],
  ['LÕ45329', 'Saverna lasteaed-külakeskus', 'Põlva maakond, Kanepi vald, Saverna küla, Kooli tee 7', 6439948.36, 661515.14],
  ['LÕ12619', 'Põlva Lasketurismikeskus', 'Põlva maakond, Põlva vald, Põlva linn, Metsa tn 7', 6438342.04, 680342.83],
  ['LÕ45401', 'Räpina Ühisgümnaasium', 'Põlva maakond, Räpina vald, Räpina linn, Kooli tn 5', 6444742.14, 704175.45],
  ['LÕ67390', 'Hellenurme lasteaed', 'Tartu maakond, Elva vald, Hellenurme küla, Hellenurme mõis', 6446294.19, 640393.07],
  ['LÕ20887', 'Rannu Rahvamaja', 'Tartu maakond, Elva vald, Rannu alevik, Elva tee 7', 6457540.28, 630174.32],
  ['LÕ43857', 'Tartu Rakenduslik Kolledž (ühiselamu)', 'Tartu maakond, Tartu linn, Tartu linn, Põllu tn 11c', 6476462.77, 658704.35],
  ['LÕ46504', 'Tartu Forseliuse Kool (Loovusmaja)', 'Tartu maakond, Tartu linn, Tartu linn, Tähe tn 101', 6472164.31, 659760.74],
  ['LÕ94150', 'Tartu Rakenduslik Kolledž', 'Tartu maakond, Tartu linn, Tartu linn, Põllu tn 11a', 6476363.0, 658651.68],
  ['LÕ51021', 'Tamme staadioni spordihoone', 'Tartu maakond, Tartu linn, Tartu linn, Tamme pst 1', 6472722.35, 658723.65],
  ['LÕ73062', 'Tartu Veeriku Kool', 'Tartu maakond, Tartu linn, Tartu linn, Veeriku tn 41', 6473643.2, 657157.07],
  ['LÕ29544', 'TÜ humanitaarteaduste õppehoone', 'Tartu maakond, Tartu linn, Tartu linn, Lossi tn 3', 6474302.07, 659067.45],
  ['LÕ55150', 'TÜ raamatukogu', 'Tartu maakond, Tartu linn, Tartu linn, W. Struve tn 1', 6473911.93, 659131.84],
  ['LÄ17867', 'Türi Vallavalitsuse hoone', 'Järva maakond, Türi vald, Türi linn, Hariduse tn 3', 6519589.85, 582813.06],
  ['LÕ93585', 'Ugala Teater', 'Viljandi maakond, Viljandi linn, Vaksali tn 7', 6470157.18, 592931.35],
  ['ID12702', 'Uhtna Põhikool', 'Lääne-Viru maakond, Rakvere vald, Uhtna alevik, Nooruse tn 18', 6587059.43, 645835.06],
  ['ID61072', 'Ulvi mõis', 'Lääne-Viru maakond, Vinni vald, Ulvi küla, Mõisa tee 5', 6579328.91, 649808.51],
  ['LÕ28799', 'Hugo Treffneri Gümnaasium', 'Tartu maakond, Tartu linn, Tartu linn, Munga tn 12', 6474539.07, 659099.5],
  ['LÕ77563', 'Kristjan Jaak Petersoni Gümnaasium', 'Tartu maakond, Tartu linn, Tartu linn, Kaunase pst 70', 6473982.11, 662137.98],
  ['LÕ10988', 'Tartu Jogentaga Kool', 'Tartu maakond, Tartu linn, Tartu linn, Uus tn 54', 6474289.06, 660564.69],
  ['LÕ45325', 'Tartu Forseliuse Kool', 'Tartu maakond, Tartu linn, Tartu linn, Tähe tn 103', 6472056.88, 659748.54],
  ['PÕ963', 'Kaarli pst jalakäijate tunnel', 'Harju maakond, Tallinn, Kesklinna linnaosa, Kaarli pst 1', 6588551.25, 542187.5],
  ['PÕ59675', 'Vabaduse väljaku maa-alune parkla', 'Harju maakond, Tallinn, Kesklinna linnaosa, Vabaduse väljak', 6588633.98, 542229.69],
  ['LÄ69635', 'Uuemõisa Lasteaed-algkool', 'Lääne maakond, Haapsalu linn, Uuemõisa alevik, Lossi tn 4', 6533880.89, 475846.7],
  ['LÄ92309', 'Uulu Kultuuri- ja Spordi-keskus', 'Pärnu maakond, Häädemeeste vald, Uulu küla, Pargi tee 1', 6459895.82, 533949.3],
  ['ID34319', 'Vajangu Põhikool', 'Lääne-Viru maakond, Tapa vald, Vajangu küla, Kooli tn 7', 6554012.64, 614983.66],
  ['LÕ75304', 'Valga Buratino lasteaed', 'Valga maakond, Valga vald, Valga linn, Lai tn 6a', 6405521.05, 621281.87],
  ['LÕ36236', 'Valga Gümnaasium', 'Valga maakond, Valga vald, Valga linn, J. Kuperjanovi tn 10', 6405879.89, 621387.0],
  ['LÕ31426', 'Valga Piirimetsa Kool', 'Valga maakond, Valga vald, Valga linn, Vabaduse tn 13', 6405696.44, 621330.26],
  ['ID62612', 'Veltsi Lasteaed-Algkool', 'Lääne-Viru maakond, Rakvere vald, Veltsi küla, Veltsi tee 9', 6586756.37, 629335.39],
  ['LÕ51909', 'Viljandi Jakobsoni kool', 'Viljandi maakond, Viljandi linn, Riia mnt 91', 6468437.48, 592609.38],
  ['LÕ84591', 'Viljandi Kesklinna kool', 'Viljandi maakond, Viljandi linn, C. R. Jakobsoni tn 42', 6470557.94, 594309.72],
  ['LÕ69530', 'Viljandi Lasteaed "Krõllipesa"', 'Viljandi maakond, Viljandi linn, Riia mnt 30', 6469308.9, 592614.22],
  ['ID48816', 'Vinni-Pajusti Gümnaasium', 'Lääne-Viru maakond, Vinni vald, Vinni alevik, Tammiku tn 9', 6574634.88, 637966.74],
  ['LÕ57577', 'Võru Lasteaed Sõleke', 'Võru maakond, Võru linn, Olevi tn 29', 6414720.85, 678876.57],
  ['LÕ75487', 'Võru Kesklinna kool', 'Võru maakond, Võru linn, Vabaduse tn 12', 6415504.8, 677913.88],
  ['LÕ66602', 'Võru Kreutzwaldi Kool', 'Võru maakond, Võru linn, Kooli tn 7', 6415714.5, 678616.42],
  ['LÕ79800', 'Võru Linnavalitsus', 'Võru maakond, Võru linn, Tartu tn 25', 6415738.5, 677878.68],
  ['LÕ38736', 'Ülenurme Spordihoone', 'Tartu maakond, Kambja vald, Ülenurme alevik, Tartu mnt 5', 6467842.92, 659507.74],
  ['ID76495', 'Wiru Spordikeskus - Kohtla-Järve Spordikeskus', 'Ida-Viru maakond, Kohtla-Järve linn, Järve linnaosa, Järveküla tee 41', 6588956.49, 686057.03],
  ['LÄ71296', 'Vändra Gümnaasium', 'Pärnu maakond, Põhja-Pärnumaa vald, Vändra alev, Kooli tn 13/2', 6501169.96, 560397.11],
  ['LÄ91213', 'Õpilaskodu 3', 'Rapla maakond, Märjamaa vald, Vana-Vigala küla, Pikk tn 8', 6515770.44, 514798.0],
  ['LÄ51929', 'Õpilaskodu 4', 'Rapla maakond, Märjamaa vald, Vana-Vigala küla, Kodu tn 5', 6515757.84, 514727.95],
  ['LÄ96786', 'ööklubi Lokaal', 'Saare maakond, Saaremaa vald, Kuressaare linn, Tallinna tn 11', 6457992.84, 411122.11],
  ['PÕ24722', 'Ülemiste keskus', 'Harju maakond, Tallinn, Lasnamäe linnaosa, Suur-Sõjamäe tn 4', 6587358.05, 545034.97],
  ['ID89568', 'Kadrina Spordikeskus', 'Lääne-Viru maakond, Kadrina vald, Kadrina alevik, Rakvere tee 14', 6580581.39, 621728.3],
  ['ID26894', 'büroohoone', 'Ida-Viru maakond, Jõhvi vald, Jõhvi linn, Jaama tn 10', 6584988.94, 693570.57],
  ['PÕ31681', 'Jalakäijate tunnel', 'Harju maakond, Saue vald, Laagri alevik, 4 Tallinn-Pärnu-Ikla tee L1', 6578394.03, 535079.07],
  ['ID18059', 'Kadrina Huvikeskus', 'Lääne-Viru maakond, Kadrina vald, Kadrina alevik, Rakvere tee 4', 6580239.5, 621331.05],
  ['LÄ24594', 'Valsimaja', 'Saare maakond, Saaremaa vald, Kuressaare linn, Ravila tn 1a', 6457825.66, 410225.67],
  ['LÄ15505', 'Muhu maja', 'Saare maakond, Muhu vald, Liiva küla, Keskuse', 6496407.31, 455450.93],
  ['LÕ74343', 'Tabivere põhikool', 'Tartu maakond, Tartu vald, Tabivere alevik, Hariduse tn 1', 6492718.35, 651749.94],
  ['LÕ41128', 'J. V. Veski nim Maarja-Magdaleena Põhikool', 'Tartu maakond, Tartu vald, Maarja-Magdaleena küla, Maarja põhikool', 6500848.88, 659093.75],
  ['LÕ93671', 'Laeva lasteaed-külakeskus', 'Tartu maakond, Tartu vald, Laeva küla, Väänikvere tee 6', 6485582.76, 639086.43],
  ['LÕ75244', 'Hargla Kool', 'Valga maakond, Valga vald, Hargla küla, Hargla kool', 6388433.84, 644333.98],
  ['LÕ89225', 'Tsirguliina Kool', 'Valga maakond, Valga vald, Tsirguliina alevik, Nooruse tn 1', 6415752.69, 630047.85],
  ['LÕ19919', 'Õru Lasteaed-Algkool', 'Valga maakond, Valga vald, Õru alevik, Ringtee 13', 6422505.13, 629074.71],
  ['LÕ71827', 'August Kitzbergi nimeline Gümnaasium', 'Viljandi maakond, Mulgi vald, Karksi-Nuia linn, Kooli tn 1', 6441168.7, 591856.93],
  ['LÕ62528', 'Apteegi hoone', 'Viljandi maakond, Mulgi vald, Karksi-Nuia linn, Kalda tn 6b', 6441476.81, 591463.38],
  ['LÕ35603', 'Abja lasteaed', 'Viljandi maakond, Mulgi vald, Abja-Paluoja linn, Aia tn 24', 6443737.06, 579483.89],
  ['LÕ37208', 'Viiratsi Kool', 'Viljandi maakond, Viljandi vald, Viiratsi alevik, Sakala tn 4', 6469814.21, 595945.8],
  ['PÕ44698', 'Haabersti LOV', 'Harju maakond, Tallinn, Haabersti linnaosa, Ehitajate tee 109a', 6586373.81, 537276.66],
  ['PÕ56860', 'Eakate päevakeskus', 'Harju maakond, Tallinn, Mustamäe linnaosa, Ehitajate tee 82', 6585694.39, 538215.94],
  ['LÕ20547', 'endine Võru teenindusmaja', 'Võru maakond, Võru linn, Lembitu tn 2', 6415772.1, 677924.91],
  ['LÄ49630', 'Administratiivhoone', 'Lääne maakond, Haapsalu linn, Haapsalu linn, Ehte tn 9', 6534493.6, 473227.75],
  ['ID67400', 'Administratiivhoone', 'Ida-Viru maakond, Narva linn, Haigla tn 6', 6588034.77, 738320.57],
  ['ID18539', 'Administratiivhoone', 'Ida-Viru maakond, Narva linn, P. Kerese tn 20', 6589316.12, 737434.17],
  ['PÕ41281', 'Balti jaama jalakäiate tunnel', 'Harju maakond, Tallinn, Kesklinna linnaosa, Toompuiestee T2', 6589365.95, 541936.84],
  ['PÕ30306', 'Balti Jaama Turg', 'Harju maakond, Tallinn, Põhja-Tallinna linnaosa, Kopli tn 1', 6589489.75, 541708.29],
  ['ID35606', 'Bastioni käigud', 'Ida-Viru maakond, Narva linn, Pimeaia tn 1', 6590218.58, 738663.74],
  ['LÄ15248', 'Elamuskeskus Tuuletorn', 'Hiiu maakond, Hiiumaa vald, Käina alevik, Mäe tn 4', 6521910.07, 429126.31],
  ['ID71882', 'Endine Rägavere vallamaja', 'Lääne-Viru maakond, Vinni vald, Ulvi küla, Mõisa tee 7', 6579284.0, 649824.89],
  ['LÄ22656', 'Endine saun', 'Saare maakond, Saaremaa vald, Kuressaare linn, Rehe tn 5', 6458731.04, 411252.68],
  ['LÄ53088', 'E-Piim Spordihall', 'Järva maakond, Paide linn, Paide linn, Aiavilja tn 1', 6528506.71, 590225.69],
  ['LÄ21459', 'Grand Rose SPA', 'Saare maakond, Saaremaa vald, Kuressaare linn, Tallinna tn 15', 6458046.24, 411208.85],
  ['LÄ16001', 'Haapsalu Kaubamaja', 'Lääne maakond, Haapsalu linn, Haapsalu linn, Tallinna mnt 1', 6533566.78, 473651.16],
  ['LÄ14661', 'Haapsalu Kultuurikeskus', 'Lääne maakond, Haapsalu linn, Haapsalu linn, Posti tn 3', 6534082.0, 473492.58],
  ['LÄ94874', 'Haapsalu Noorte Huvikeskus', 'Lääne maakond, Haapsalu linn, Haapsalu linn, F. J. Wiedemanni tn 4', 6534566.62, 473236.88],
  ['LÄ44482', 'Hiiuma Ametikool', 'Hiiu maakond, Hiiumaa vald, Suuremõisa küla, Lossi tee 3', 6526137.72, 439149.21],
  ['LÄ28422', 'Imavere põhikool-rahvamaja', 'Järva maakond, Järva vald, Imavere küla, Kiigevere tee 5', 6511546.29, 602403.98],
  ['ID57437', 'Jewe Keskus', 'Ida-Viru maakond, Jõhvi vald, Jõhvi linn, Raudtee tn 5', 6584840.58, 694350.59],
  ['ID77195', 'Jäneda loss', 'Lääne-Viru maakond, Tapa vald, Jäneda küla, Jäneda loss', 6568466.97, 596027.8],
  ['LÄ31406', 'Järva-Jaani Gümnaasium', 'Järva maakond, Järva vald, Järva-Jaani alev, Pikk tn 1', 6546890.78, 608105.93],
  ['PÕ30495', 'Kaubamaja jalakäiate tunnel', 'Harju maakond, Tallinn, Kesklinna linnaosa, Ants Laikmaa tänav', 6588880.34, 542991.25],
  ['PÕ93758', 'Keila linnavalitsuse hoone', 'Harju maakond, Keila linn, Keskväljak 11', 6574516.59, 524195.6],
  ['PÕ25824', 'Keila Tervisekeskus', 'Harju maakond, Keila linn, Paldiski mnt 17', 6575248.86, 523446.84],
  ['PÕ39358', 'Kesklinna sotsiaalkeskus', 'Harju maakond, Tallinn, Kesklinna linnaosa, Liivalaia tn 32', 6588155.65, 542930.75],
  ['LÕ20695', 'Herbert Masingu Kool', 'Tartu maakond, Tartu linn, Tartu linn, Vanemuise tn 33', 6473816.82, 659100.64],
  ['LÕ38436', 'Kambja Lasteaed Mesimumm', 'Tartu maakond, Kambja vald, Kambja alevik, Kesk tn 4', 6458078.88, 658505.2],
  ['LÄ46746', 'Kihelkonna kool-lasteaed', 'Saare maakond, Saaremaa vald, Kihelkonna alevik, Kooli tn 1', 6470752.98, 384654.52],
  ['PÕ13032', 'Kiili vallamaja', 'Harju maakond, Kiili vald, Kiili alev, Nabala tee 2a', 6574691.45, 547575.93],
  ['LÄ67355', 'Kilingi-Nõmme Tervise- ja Hoolduskeskus', 'Pärnu maakond, Saarde vald, Kilingi-Nõmme linn, Pärnu tn 65/1', 6445733.25, 556583.01],
  ['LÄ44500', 'Koeru kultuurimaja', 'Järva maakond, Järva vald, Koeru alevik, Paide tee 3', 6537704.26, 616520.02],
  ['LÄ31890', 'Koeru Tervisekeskus', 'Järva maakond, Järva vald, Koeru alevik, Paide tee 16a', 6537640.3, 616267.84],
  ['ID30538', 'Kohtla-Järve Kultuurikeskus', 'Ida-Viru maakond, Kohtla-Järve linn, Järve linnaosa, Keskallee 36', 6589140.58, 685882.37],
  ['ID57742', 'Kohtla-Järve Maleva põhikool', 'Ida-Viru maakond, Kohtla-Järve linn, Ahtme linnaosa, Maleva tn 4', 6581543.72, 694975.15],
  ['LÄ91750', 'Koigi haldushoone', 'Järva maakond, Järva vald, Koigi küla, Mõisavahe tee 1', 6523195.11, 601203.92],
  ['LÄ85266', 'Konesko Türi Spordihoone', 'Järva maakond, Türi vald, Türi linn, F. J. Wiedemanni tn 3a/1', 6519850.0, 582805.87],
  ['PÕ99751', 'Kose Kultuurikeskus', 'Harju maakond, Kose vald, Kose alevik, Hariduse tn 2', 6561157.4, 566393.06],
  ['PÕ95771', 'Kristiine lo valitsus', 'Harju maakond, Tallinn, Kristiine linnaosa, Metalli tn 5', 6587977.04, 540169.39],
  ['PÕ70216', 'Kultuurikatel', 'Harju maakond, Tallinn, Põhja-Tallinna linnaosa, Põhja puiestee T7', 6589890.63, 542600.39],
  ['LÄ34732', 'Kuressaare kultuurikeskus', 'Saare maakond, Saaremaa vald, Kuressaare linn, Tallinna tn 6', 6457901.86, 411171.83],
  ['LÄ44951', 'Kuressaare Linnateater', 'Saare maakond, Saaremaa vald, Kuressaare linn, Tallinna tn 20', 6458045.0, 411347.85],
  ['LÕ72261', 'Ramsi Vaba Aja Keskus', 'Viljandi maakond, Viljandi vald, Ramsi alevik, Ramsi tee 5', 6463991.94, 590232.91],
  ['LÄ81744', 'Kuressaare Spordihoone', 'Saare maakond, Saaremaa vald, Kuressaare linn, Vallimaa tn 16a', 6458531.75, 411153.04],
  ['ID40781', 'Laekvere Rahvamaja', 'Lääne-Viru maakond, Vinni vald, Laekvere alevik, Kesk tn 12', 6550436.52, 646719.64],
  ['ID52104', 'Lasila Põhikool', 'Lääne-Viru maakond, Rakvere vald, Lasila küla, Vahtra pst 17/1', 6570148.07, 626417.49],
  ['LÄ37545', 'Lihula Muusika- ja Kunstikool', 'Pärnu maakond, Lääneranna vald, Lihula linn, Tallinna mnt 25', 6505293.83, 490405.99],
  ['PÕ15527', 'Liivalaia jalakäiate tunnel', 'Harju maakond, Tallinn, Kesklinna linnaosa, Liivalaia tänav T1', 6587993.7, 542337.43],
  ['ID31633', 'Linnamajandusameti hoone', 'Ida-Viru maakond, Narva linn, Peetri plats 3', 6589407.8, 738367.07],
  ['ID73911', 'Linnavalitsuse hoone', 'Ida-Viru maakond, Narva linn, Peetri plats 5', 6589422.59, 738406.7],
  ['ID37427', 'Linnavolikogu hoone', 'Ida-Viru maakond, Narva linn, Peetri plats 1', 6589394.55, 738329.98],
  ['LÄ67140', 'Maapanga hoone', 'Saare maakond, Saaremaa vald, Kuressaare linn, Tallinna tn 27', 6458207.5, 411537.03],
  ['PÕ37185', 'Margareeta aed Bunker', 'Harju maakond, Tallinn, Kesklinna linnaosa, Pikk tn 72', 6589681.64, 542542.54],
  ['PÕ37530', 'Margareeta aed Citysec', 'Harju maakond, Tallinn, Kesklinna linnaosa, Margareeta aed', 6589629.19, 542577.29],
  ['PÕ23710', 'Meriküla õppekeskus', 'Harju maakond, Harku vald, Meriküla, Tilgu tee 53', 6592197.34, 525703.8],
  ['LÄ26783', 'Märjamaa raamatukogu', 'Rapla maakond, Märjamaa vald, Märjamaa alev, Pärnu mnt 56', 6529644.15, 524665.29],
  ['LÄ88535', 'Märjamaa rahvamaja', 'Rapla maakond, Märjamaa vald, Märjamaa alev, Sauna tn 2', 6529529.01, 524678.81],
  ['PÕ54365', 'Nõmme lo valitsus', 'Harju maakond, Tallinn, Nõmme linnaosa, Valdeku tn 13', 6583114.45, 539324.3],
  ['PÕ47921', 'Tornimäe maa-alune parkla', 'Harju maakond, Tallinn, Kesklinna linnaosa, Rävala puiestee T7', 6588688.72, 543127.93],
  ['LÕ90673', 'Kuuste Kool', 'Tartu maakond, Kambja vald, Vana-Kuuste küla, Kooli tee 2', 6460287.12, 663305.41],
  ['LÄ14325', 'Orissaare Gümnaasium', 'Saare maakond, Saaremaa vald, Orissaare alevik, Kuivastu mnt 29/1', 6491447.8, 446566.64],
  ['LÄ72449', 'Orissaare Gümnaasiumi hostel-õpilaskodu', 'Saare maakond, Saaremaa vald, Orissaare alevik, Sadama tn 5', 6491485.0, 446709.23],
  ['LÄ22342', 'Paide Muusika- ja Teatrimaja', 'Järva maakond, Paide linn, Paide linn, Pärnu tn 18', 6528475.7, 590032.92],
  ['LÄ90140', 'Paide Sookure Lasteaed', 'Järva maakond, Paide linn, Paide linn, Soo tn 16', 6529186.07, 590007.41],
  ['LÄ10386', 'Paikuse osavallakeskus', 'Pärnu maakond, Pärnu linn, Paikuse alev, Pärnade pst 11', 6470210.41, 536183.59],
  ['LÄ18173', 'Pastoraadihoone', 'Saare maakond, Saaremaa vald, Kuressaare linn, Kauba tn 5', 6457910.85, 410979.7],
  ['LÄ64335', 'Peetri kool-rahvamaja', 'Järva maakond, Järva vald, Peetri alevik, Kesktee 11', 6535347.6, 605631.19],
  ['PÕ82493', 'Pirita lo valitsus', 'Harju maakond, Tallinn, Pirita linnaosa, Kloostri tee 6', 6592304.98, 547261.83],
  ['LÄ70075', 'Port Artur 1', 'Pärnu maakond, Pärnu linn, Pärnu linn, Hommiku tn 2', 6471890.59, 529430.56],
  ['LÄ14017', 'Port Arturi parkimismaja', 'Pärnu maakond, Pärnu linn, Pärnu linn, Lai tn 7', 6471992.52, 529372.51],
  ['LÄ23016', 'Pärnu Hotell', 'Pärnu maakond, Pärnu linn, Pärnu linn, Rüütli tn 44', 6471752.8, 529641.52],
  ['LÕ23098', 'Heimtali Põhikooli spordihoone', 'Viljandi maakond, Viljandi vald, Heimtali küla, Ridaelamu tee 1', 6465564.21, 587971.19],
  ['LÕ49606', 'Põlva Roosi kool', 'Põlva maakond, Põlva vald, Põlva linn, Lina tn 13', 6439517.48, 681312.11],
  ['LÄ47106', 'Pärnu Keskus', 'Pärnu maakond, Pärnu linn, Pärnu linn, Aida tn 7', 6471935.67, 529314.68],
  ['LÄ70044', 'Pärnu Vanalinna Põhikooli võimla', 'Pärnu maakond, Pärnu linn, Pärnu linn, Pühavaimu tn 19', 6471495.41, 529317.84],
  ['LÄ50243', 'Pärnu-Jaagupi põhikool', 'Pärnu maakond, Põhja-Pärnumaa vald, Pärnu-Jaagupi alev, Kooli tn 3', 6496753.06, 529059.65],
  ['LÕ40516', 'Püssirohukelder', 'Tartu maakond, Tartu linn, Tartu linn, Lossi tn 28', 6474177.08, 659020.7],
  ['LÄ50777', 'Raekoda', 'Saare maakond, Saaremaa vald, Kuressaare linn, Tallinna tn 2', 6457895.48, 411086.56],
  ['LÕ15601', 'Rahvusarhiivi Valga uurimissaal', 'Valga maakond, Valga vald, Valga linn, Vabaduse tn 6', 6405759.22, 621188.23],
  ['ID70421', 'Rakvere Ametikool', 'Lääne-Viru maakond, Rakvere linn, Piiri tn 8/1', 6580170.61, 635307.35],
  ['ID58245', 'Rakvere Kultuurikeskus', 'Lääne-Viru maakond, Rakvere linn, F. R. Kreutzwaldi tn 2', 6581486.4, 633683.35],
  ['ID52755', 'Rakvere Reaalkool', 'Lääne-Viru maakond, Rakvere linn, Võidu tn 67', 6581210.86, 634796.36],
  ['ID67681', 'Rakvere Teater', 'Lääne-Viru maakond, Rakvere linn, F. R. Kreutzwaldi tn 2a', 6581458.92, 633655.03],
  ['ID90056', 'Rakvere Vabaduse Kool', 'Lääne-Viru maakond, Rakvere linn, Vabaduse tn 1', 6580796.27, 634514.58],
  ['LÄ90796', 'Rapla Kultuurikeskus', 'Rapla maakond, Rapla vald, Rapla linn, Tallinna mnt 17a', 6540893.31, 545634.19],
  ['LÄ42577', 'Rapla Riigimaja', 'Rapla maakond, Rapla vald, Rapla linn, Tallinna mnt 14', 6541019.22, 545575.75],
  ['PÕ98501', 'RKAS büroohoone maa-aluneparkla', 'Harju maakond, Tallinn, Lasnamäe linnaosa, Lasnamäe tn 2', 6587958.75, 544390.32],
  ['ID65615', 'Roela Kool', 'Lääne-Viru maakond, Vinni vald, Roela alevik, Järve tn 1', 6561949.38, 648300.56],
  ['LÕ87847', 'Sakala keskus', 'Viljandi maakond, Viljandi linn, Tallinna tn 5', 6470552.41, 593422.82],
  ['PÕ59078', 'Salme kultuurikeskus', 'Harju maakond, Tallinn, Põhja-Tallinna linnaosa, Salme tn 12', 6589900.74, 541394.01],
  ['LÄ16812', 'Sauga Teenuskeskus', 'Pärnu maakond, Tori vald, Sauga alevik, Selja tee 1a', 6476830.71, 529339.92],
  ['ID75269', 'Sillamäe Kannuka Kool', 'Ida-Viru maakond, Sillamäe linn, Geoloogia tn 13', 6589965.62, 715713.5],
  ['ID64679', 'Sillamäe Kultuurikeskus', 'Ida-Viru maakond, Sillamäe linn, Kesk tn 24', 6590228.99, 713709.05],
  ['LÄ79885', 'Sindi lasteaed', 'Pärnu maakond, Tori vald, Sindi linn, Kooli tn 2a', 6474112.5, 538205.3],
  ['PÕ79788', 'Solarise keskus', 'Harju maakond, Tallinn, Kesklinna linnaosa, Estonia pst 9', 6588611.6, 542649.44],
  ['ID76985', 'Sotsiaalabiameti hoone', 'Ida-Viru maakond, Narva linn, Malmi tn 5a', 6589112.63, 738321.96],
  ['PÕ48908', 'Sotsiaalmaja', 'Harju maakond, Tallinn, Nõmme linnaosa, Pihlaka tn 12', 6582041.63, 540508.55],
  ['ID98611', 'Sõmeru Avatud Noortekeskus', 'Lääne-Viru maakond, Rakvere vald, Sõmeru alevik, Tiigi tn 2', 6582723.07, 638558.93],
  ['PÕ74995', 'Tabasalu kaubanduskeskus', 'Harju maakond, Harku vald, Tabasalu alevik, Kallaste tn 7', 6588033.8, 531217.56],
  ['PÕ85315', 'Tabasalu spordikompleks', 'Harju maakond, Harku vald, Tabasalu alevik, Kooli tn 11', 6587903.52, 530283.08],
  ['ID93868', 'Tamsalu jalakäijate tunnel', 'Lääne-Viru maakond, Tapa vald, Tamsalu linn, Paide mnt 3', 6559899.69, 620718.64],
  ['ID82671', 'Tamsalu Kultuurimaja', 'Lääne-Viru maakond, Tapa vald, Tamsalu linn, Sõpruse tn 3', 6560183.36, 621119.44],
  ['ID10665', 'Tamsalu Lasteaed Krõll', 'Lääne-Viru maakond, Tapa vald, Tamsalu linn, Metsa tn 1', 6560604.55, 620532.54],
  ['ID81686', 'Tamsalu Spordikompleks', 'Lääne-Viru maakond, Tapa vald, Tamsalu linn, Tehnika tn 2a', 6560564.01, 620344.58],
  ['ID84338', 'Tapa Gümnaasium', 'Lääne-Viru maakond, Tapa vald, Tapa linn, Nooruse tn 2', 6570608.61, 611972.44],
  ['LÕ45902', 'Tartu Pärli Kool', 'Tartu maakond, Tartu linn, Tartu linn, Puiestee tn 62', 6475527.5, 659352.74],
  ['ID48933', 'Tapa Lasteaed Pisipõnn', 'Lääne-Viru maakond, Tapa vald, Tapa linn, Nooruse tn 11', 6570903.26, 612157.65],
  ['ID49093', 'Tapa valla kultuurikeskus', 'Lääne-Viru maakond, Tapa vald, Tapa linn, Kesk tn 4', 6571083.04, 611750.26],
  ['LÕ81984', 'Tartu Jaan Poska Gümnaasium', 'Tartu maakond, Tartu linn, Tartu linn, Vanemuise tn 35', 6473763.49, 659083.63],
  ['LÕ78476', 'Tartu Linnaraamatukogu', 'Tartu maakond, Tartu linn, Tartu linn, Kompanii tn 3', 6474448.39, 659290.9],
  ['LÕ37835', 'Tartu Rakenduslik Kolledž', 'Tartu maakond, Tartu linn, Tartu linn, Kopli tn 1', 6470882.65, 658882.98],
  ['LÄ70512', 'Tihemetsa Huvi- ja Spordikeskus', 'Pärnu maakond, Saarde vald, Tihemetsa alevik, Valga mnt 21', 6445811.81, 561823.82],
  ['LÄ31582', 'Tootsi lasteaed/ halduskeskus', 'Pärnu maakond, Põhja-Pärnumaa vald, Tootsi alev, Tuleviku tn 1', 6494056.18, 545610.55],
  ['LÄ62833', 'Tori põhikool', 'Pärnu maakond, Tori vald, Tori alevik, Virula tn 11', 6482111.64, 546592.26],
  ['PÕ65819', 'Tondiraba jäähall', 'Harju maakond, Tallinn, Lasnamäe linnaosa, Varraku tn 14', 6589790.99, 548155.22],
  ['LÕ84907', 'Tartu Descartes´i Kool', 'Tartu maakond, Tartu linn, Tartu linn, Anne tn 65', 6473883.14, 661300.92],
  ['LÕ35635', 'Tõrvandi Lasteaed Rüblik', 'Tartu maakond, Kambja vald, Tõrvandi alevik, Ringtee 1', 6467712.64, 658552.86],
  ['LÕ20855', 'TÜ Delta keskus', 'Tartu maakond, Tartu linn, Tartu linn, Narva mnt 18', 6474889.72, 659353.56],
  ['LÄ19272', 'Tõstamaa mõis', 'Pärnu maakond, Pärnu linn, Tõstamaa alevik, Kalli mnt 13', 6466952.53, 499778.64],
  ['PÕ64433', 'Kehra Tervisekeskus', 'Harju maakond, Anija vald, Kehra linn, F. R. Kreutzwaldi tn 7', 6578062.74, 576024.9],
  ['PÕ22158', 'Sotsiaalmaja', 'Harju maakond, Anija vald, Kehra linn, Kose mnt 22', 6577438.72, 576291.99],
  ['PÕ59320', 'Alavere Põhikool', 'Harju maakond, Anija vald, Alavere küla, Kose mnt 6', 6568292.72, 575712.89],
  ['PÕ63255', 'Anija Mõis', 'Harju maakond, Anija vald, Anija küla, Kehra tee 8', 6583346.44, 573925.78],
  ['LÕ74502', 'Võhma Coop', 'Viljandi maakond, Põhja-Sakala vald, Võhma linn, Tallinna tn 26', 6499996.83, 590494.63],
  ['LÕ45184', 'Teenindushoone', 'Viljandi maakond, Põhja-Sakala vald, Suure-Jaani linn, Pärnu tn 10', 6489412.84, 585254.39],
  ['PÕ22421', 'Mustakivi jalakäijate tunnel', 'Harju maakond, Tallinn, Lasnamäe linnaosa, Kivila tn 28', 6589787.6, 549603.52],
  ['LÕ46272', 'Elva Gümnaasium algkooli õppehoone', 'Tartu maakond, Elva vald, Elva linn, Tartu mnt 3/1', 6456164.8, 641546.39],
  ['PÕ67096', 'Filtri tee jalakäijate tunnel', 'Harju maakond, Tallinn, Kesklinna linnaosa, Järvevana tee T12', 6587268.8, 543836.43],
  ['LÕ96328', 'Konguta Kool', 'Tartu maakond, Elva vald, Annikoru küla, Annikoru tee 7', 6460724.37, 635474.12],
  ['PÕ21312', 'Renniotsa jalakäijate tunnel', 'Harju maakond, Tallinn, Kesklinna linnaosa, Järvevana tee T4', 6586454.59, 543115.23],
  ['PÕ54192', 'Lotomaja', 'Harju maakond, Tallinn, Kesklinna linnaosa, Hallivanamehe tn 4', 6585927.93, 541698.44],
  ['PÕ45249', 'Veskitammi jalgteetunnel', 'Harju maakond, Saue vald, Laagri alevik, 4 Tallinn-Pärnu-Ikla tee L24', 6579356.64, 535726.17],
  ['PÕ97986', 'Tallinn-Pärnu-Ikla mnt km 18,84', 'Harju maakond, Saku vald, Saue küla, 4 Tallinn-Pärnu-Ikla tee L12', 6574735.55, 532437.89],
  ['PÕ73151', 'Kose Kultuurikeskus', 'Harju maakond, Kose vald, Kose alevik, Hariduse tn 2', 6561188.18, 566355.08],
  ['ID43576', 'Rakvere Linnavalitsus', 'Lääne-Viru maakond, Rakvere linn, Lai tn 20', 6581224.37, 634260.74],
  ['ID87512', 'Kunda klubi', 'Lääne-Viru maakond, Viru-Nigula vald, Kunda linn, Lasteaia tn 4', 6598758.06, 643867.19],
  ['LÕ45321', 'Nõo Põhikool', 'Tartu maakond, Nõo vald, Nõo alevik, Kalju Aigro tänav', 6462737.55, 648777.34],
  ['ID54370', 'Kiviõli Riigikool Viru õppekoht', 'Ida-Viru maakond, Lüganuse vald, Kiviõli linn, Viru tn 14', 6583742.43, 669133.3],
  ['LÕ45322', 'Puurmani rahvamaja', 'Jõgeva maakond, Põltsamaa vald, Puurmani alevik, Ülejõe tn 4', 6494739.99, 633322.75],
  ['LÄ00001', 'Väätsa Põhikool', 'Järva maakond, Türi vald, Väätsa alevik, Kooli tn 1', 6528581.72, 583701.89],
  ['LÄ00002', 'Türi kolledzi kohvik', 'Järva maakond, Türi vald, Türi linn, Viljandi tn 13b', 6519074.69, 582688.05],
  ['ID47856', 'Vaivara raamatukogu', 'Ida-Viru maakond, Narva-Jõesuu linn, Vaivara küla, Poe tn 3', 6587778.56, 713873.54],
  ['ID47156', 'Narva-Jõesuu Noortekeskus', 'Ida-Viru maakond, Narva-Jõesuu linn, Narva-Jõesuu linn, Kesk tn 3', 6598247.8, 729054.2],
  ['ID38529', 'Lasteaed Päikseke', 'Ida-Viru maakond, Sillamäe linn, J. Gagarini tn 25', 6589972.41, 715006.35],
  ['ID34921', 'Kiviõli Riigikool', 'Ida-Viru maakond, Lüganuse vald, Lüganuse alevik, Kiviõli tee 25/1', 6585559.81, 673081.54],
  ['LÄ66406', 'Kehtna Lasteaed', 'Rapla maakond, Kehtna vald, Kehtna alevik, Lasteaia tn 5', 6532163.13, 550277.73],
  ['LÄ22721', 'Kehtna Kutsehariduskeskus', 'Rapla maakond, Kehtna vald, Kehtna alevik, Kooli tn 1', 6532089.11, 549985.29],
  ['LÄ19527', 'Järvakandi lasteaed', 'Rapla maakond, Kehtna vald, Järvakandi alev, Pargi tn 3', 6515369.6, 547146.54],
  ['LÄ77564', 'Järvakandi kool', 'Rapla maakond, Kehtna vald, Järvakandi alev, Nõlva tn 16', 6515369.18, 546565.3],
  ['LÄ96118', 'Kehtna Põhikool', 'Rapla maakond, Kehtna vald, Kehtna alevik, Staadioni tn 16', 6532540.87, 550063.56],
  ['ID54856', 'Viru-Nigula saun, raamatukogu', 'Lääne-Viru maakond, Viru-Nigula vald, Viru-Nigula alevik, Kirikaia tn 2', 6592980.71, 652525.88],
  ['ID85269', 'Kunda spordikeskus', 'Lääne-Viru maakond, Viru-Nigula vald, Kunda linn, Kasemäe tn 19', 6598445.56, 642304.69],
  ['PÕ81155', 'Pakri Plaza kelder', 'Harju maakond, Lääne-Harju vald, Paldiski linn, Rae tn 38', 6579397.51, 503206.64],
  ['PÕ81166', 'Ranna Tee 8', 'Harju maakond, Lääne-Harju vald, Vasalemma alevik, Ranna tee 8', 6567275.63, 516551.56],
  ['PÕ81177', 'Paadi ärikeskus', 'Harju maakond, Viimsi vald, Haabneeme alevik, Paadi tee 3', 6596527.83, 546810.16],
  ['PÕ54195', 'Öpiku majad', 'Harju maakond, Tallinn, Lasnamäe linnaosa, Valukoja tn 8/2', 6587130.15, 545673.31],
  ['PÕ54198', 'Tallinna Lennujaam', 'Harju maakond, Tallinn, Lasnamäe linnaosa, Tartu mnt 101', 6586770.8, 545361.72],
  ['PÕ45250', 'Reval Sport', 'Harju maakond, Tallinn, Kesklinna linnaosa, Aia tn 20', 6589444.24, 542635.94],
  ['PÕ81133', 'Loksa Varjend', 'Harju maakond, Loksa linn, Posti tn 44', 6606587.05, 597838.55],
  ['PÕ81111', 'Lindakivi kultuurikeskus', 'Harju maakond, Tallinn, Lasnamäe linnaosa, J. Koorti tn 22', 6589513.53, 547183.98],
  ['PÕ81100', 'Kunstigalerii kelder', 'Harju maakond, Tallinn, Kesklinna linnaosa, Pärnu mnt 6', 6588876.81, 542505.86],
  ['PÕ54183', 'Keskkonnaagentuuri kelder', 'Harju maakond, Tallinn, Kristiine linnaosa, Mustamäe tee 33a', 6587528.44, 539777.73],
  ['ID86543', 'Liivarand Spa', 'Ida-Viru maakond, Narva-Jõesuu linn, Narva-Jõesuu linn, L. Koidula tn 21', 6595967.04, 727357.42],
  ['ID56841', 'Kultuurimaja Rugodiv', 'Ida-Viru maakond, Narva linn, A. Puškini tn 8', 6589119.38, 738520.51],
  ['ID58761', 'Lasteaed Kalevipoeg', 'Ida-Viru maakond, Jõhvi vald, Jõhvi linn, Hariduse tn 7', 6583886.96, 694230.96],
  ['PÕ23487', 'Viimsi Artium', 'Harju maakond, Viimsi vald, Lubja küla, Randvere tee 20', 6597599.12, 547427.34],
  ['ID87513', 'Tallinna Ülikooli Rakvere õppehoone (kasutuseta)', 'Lääne-Viru maakond, Rakvere linn, Pikk tn 40', 6581022.22, 633977.54],
  ['ID51933', 'Büroohoone', 'Ida-Viru maakond, Jõhvi vald, Jõhvi linn, Jaama tn 14', 6585094.97, 693604.0],
  ['PÕ54193', 'Mustika keskus', 'Harju maakond, Tallinn, Mustamäe linnaosa, Mustamäe tee 86a', 6586072.9, 538862.89],
  ['ID21896', 'Aseri kool', 'Lääne-Viru maakond, Viru-Nigula vald, Aseri alevik, Kooli tn 2', 6593593.99, 662140.62],
  ['LÄ57204', 'Grahv Zeppelini büroo- ja kortermaja', 'Pärnu maakond, Pärnu linn, Pärnu linn, Lai tn 15', 6472025.61, 529632.6],
  ['LÄ87277', 'Büroo- ja kortermaja', 'Pärnu maakond, Pärnu linn, Pärnu linn, Lai tn 15a', 6472003.13, 529621.06],
  ['ID57914', 'Lasteaed', 'Ida-Viru maakond, Kohtla-Järve linn, Järve linnaosa, Pärna tn 36', 6589703.86, 686707.52],
  ['ID48709', 'raekoda', 'Ida-Viru maakond, Narva linn, Raekoja plats 1', 6589843.99, 738518.55],
  ['LÄ79877', 'Kuninga tn Põhikool', 'Pärnu maakond, Pärnu linn, Pärnu linn, Kuninga tn 29', 6471548.4, 529578.6],
  ['LÄ48663', 'Raeküla kool', 'Pärnu maakond, Pärnu linn, Pärnu linn, Käo tn 4', 6468532.33, 533594.8],
  ['LÕ45330', 'Luutsniku kriisiõppekeskus', 'Võru maakond, Rõuge vald, Luutsniku küla, Pääste', 6391134.07, 679170.57],
  ['123456', 'Coop maja', 'Harju maakond, Tallinn, Kesklinna linnaosa, Maakri tn 30', 6588584.67, 543085.16],
  ['LÕ45331', 'Tartu Kaubamaja', 'Tartu maakond, Tartu linn, Tartu linn, Riia tn 1', 6474077.88, 659567.87],
  ['PÕ07654', 'Viimsi vallamaja kelder', 'Harju maakond, Viimsi vald, Viimsi alevik, Nelgi tee 1', 6596074.51, 547421.87],
  ['LÕ45324', 'Tartu Mänguasjamuuseum', 'Tartu maakond, Tartu linn, Tartu linn, Lutsu tn 2', 6474500.3, 658923.34],
  ['LÕ45328', 'Krootuse kool', 'Põlva maakond, Kanepi vald, Krootuse küla, Kooli tn 1', 6440365.33, 667666.2],
  ['PÕ12654', 'Haabneeme kool', 'Harju maakond, Viimsi vald, Haabneeme alevik, Randvere tee 18/3', 6597557.41, 547363.05],
  ['PÕ6578', 'Padise kauplus', 'Harju maakond, Lääne-Harju vald, Padise küla, Padise kauplus', 6565332.67, 508202.34],
  ['ID71684', 'Kohtla-Nõmme kool', 'Ida-Viru maakond, Jõhvi vald, Kohtla-Nõmme alev, Kooli tn 6', 6583950.93, 681551.27],
  ['LÕ45300', 'Kvartali keskus', 'Tartu maakond, Tartu linn, Tartu linn, Riia tn 2', 6473990.48, 659576.17],
  ['PÕ98512', 'Tallinna Kuristiku Gümnaasium', 'Harju maakond, Tallinn, Lasnamäe linnaosa, K. Kärberi tn 9', 6590122.51, 549909.77],
  ['PÕ45011', 'Tallinna Läänemere Gümnaasium', 'Harju maakond, Tallinn, Lasnamäe linnaosa, Vormsi tn 3', 6591014.7, 549237.5],
  ['PÕ22226', 'Tallinna Järveotsa Gümnaasium', 'Harju maakond, Tallinn, Haabersti linnaosa, Järveotsa tee 31', 6585944.39, 536348.44],
  ['PÕ1289', 'Tallinna Õismäe Gümnaasium', 'Harju maakond, Tallinn, Haabersti linnaosa, Õismäe tee 50', 6586361.57, 536648.44],
  ['PÕ46850', 'Tallinna Humanitaargümnaasium', 'Harju maakond, Tallinn, Kesklinna linnaosa, Koidu tn 97', 6587358.84, 541944.53],
  ['ID13975', 'Illuka kool', 'Ida-Viru maakond, Alutaguse vald, Illuka küla, Hariduse/1', 6571621.34, 699305.18],
  ['ID78109', 'Iisaku gümnaasium', 'Ida-Viru maakond, Alutaguse vald, Iisaku alevik, Tartu mnt 62', 6555314.21, 689762.7],
  ['LÄ53089', 'Ingerisoome kultuuriselts', 'Pärnu maakond, Pärnu linn, Pärnu linn, Lõuna tn 18', 6471541.51, 529208.05],
  ['LÕ45332', 'Alatskivi siselasketiir', 'Tartu maakond, Peipsiääre vald, Alatskivi alevik, Kooli tn 1a', 6499765.85, 682293.88],
  ['LÕ45333', 'Pilistvere kirikla (mõisahoone)', 'Viljandi maakond, Põhja-Sakala vald, Pilistvere küla, Pilistvere kirikla', 6503940.25, 601738.18],
  ['LÕ45334', 'Tartu turuhoone', 'Tartu maakond, Tartu linn, Tartu linn, Vabaduse pst 1', 6474137.65, 659596.14],
  ['PÕ32789', 'Kakumäe Selver', 'Harju maakond, Tallinn, Haabersti linnaosa, Rannamõisa tee 6', 6587989.36, 535548.44],
  ['PÕ97982', 'Pääsküla Noortekeskus', 'Harju maakond, Tallinn, Nõmme linnaosa, Rännaku pst 1', 6581399.66, 536533.77],
  ['PÕ45248', 'Kadrioru pargi Oranzerii', 'Harju maakond, Tallinn, Kesklinna linnaosa, L. Koidula tn 34a', 6589007.28, 544625.78],
  ['LÄ40950', 'Põhja-Järva kool', 'Järva maakond, Järva vald, Aravete alevik, Piibe mnt 21/1', 6557366.31, 600435.42],
  ['LÕ45335', 'Tõrva gümnaasiumi A-korpus', 'Valga maakond, Tõrva vald, Tõrva linn, Puiestee tn 1/2', 6431231.83, 613955.68],
  ['LÕ45336', 'Tõrva gümnaasiumi B-korpus', 'Valga maakond, Tõrva vald, Tõrva linn, Puiestee tn 1/2', 6431169.44, 613954.66],
  ['LÕ45337', 'Tõrva Kirik-Kammersaal', 'Valga maakond, Tõrva vald, Tõrva linn, Valga tn 42a', 6430365.4, 614097.82],
  ['LÕ45338', 'Ritsu spordihoone', 'Valga maakond, Tõrva vald, Linna küla, Kesk tänav', 6433944.23, 609053.6],
  ['LÕ45339', 'Hummuli mõis', 'Valga maakond, Tõrva vald, Hummuli alevik, Pargi tn 2', 6420236.39, 622078.55],
  ['LÕ45400', 'Kaubandushoone', 'Valga maakond, Tõrva vald, Tõrva linn, Tartu tn 6', 6430716.68, 613707.57],
  ['ID49317', 'Jõhvi lasteaed Sipsik', 'Ida-Viru maakond, Jõhvi vald, Jõhvi linn, Narva mnt 21', 6585141.85, 694595.7],
  ['LÄ40951', 'Haapsalu Kolledz', 'Lääne maakond, Haapsalu linn, Haapsalu linn, Lihula mnt 12/1', 6533019.79, 473607.42],
  ['PÕ97980', 'Maardu Gümnaasium', 'Harju maakond, Maardu linn, Ringi tn 64', 6594771.55, 558130.13],
  ['ID34819', 'Maidla kool', 'Ida-Viru maakond, Lüganuse vald, Maidla küla, Mõisa/1', 6581423.1, 671476.07],
  ['ID23774', 'Püssi Marjakese lasteaed', 'Ida-Viru maakond, Lüganuse vald, Püssi linn, Kooli tn 7', 6584261.96, 672564.94],
  ['LÄ40952', 'Sindi Raekoda', 'Pärnu maakond, Tori vald, Sindi linn, Pärnu mnt 12', 6473825.24, 537728.14],
  ['LÕ45405', 'Halliste kirik', 'Viljandi maakond, Mulgi vald, Pornuse küla, Halliste kirik', 6446955.93, 584549.73],
  ['LÄ40953', 'Pärnu Vabakonna Maja', 'Pärnu maakond, Pärnu linn, Pärnu linn, Lai tn 14', 6472073.07, 529543.2],
  ['ID49128', 'Väike-Maarja lasteaed', 'Lääne-Viru maakond, Väike-Maarja vald, Väike-Maarja alevik, Lõuna tn 10', 6556323.49, 629078.13],
  ['ID74563', 'Väike-Maarja seltsimaja', 'Lääne-Viru maakond, Väike-Maarja vald, Väike-Maarja alevik, Pikk tn 2', 6556355.71, 628869.14],
  ['PÕ45241', 'Rotermanni maa-alune parkls', 'Harju maakond, Tallinn, Kesklinna linnaosa, Rotermanni tn 5', 6589280.4, 542909.44],
  ['LÖ45345', 'Eesti Maaülikooli Metsamaja', 'Tartu maakond, Tartu linn, Tartu linn, F. R. Kreutzwaldi tn 5', 6475485.41, 657576.6],
  ['ID22369', 'Ukuaru muusikamaja', 'Lääne-Viru maakond, Rakvere linn, Vabaduse tn 2', 6580778.69, 634470.21],
  ['ID77996', 'Kiviõli lasteaed Kannike', 'Ida-Viru maakond, Lüganuse vald, Kiviõli linn, Võidu tn 12', 6584183.84, 669245.61],
  ['LÄ40954', 'Kuressaare Bussijaam', 'SAARE MAAKOND, SAAREMAA VALD, KURESSAARE LINN, PIHTLA TEE 3', 6458114.59, 411585.81],
  ['ID02698', 'Kadrina lasteaed', 'Lääne-Viru maakond, Kadrina vald, Hulja alevik, Tõnismäe tee 18', 6581620.56, 626505.08],
  ['PÕ45251', 'Tsiviilkaitsekelder', 'Harju maakond, Rae vald, Jüri alevik, Veetorni tn 3', 6580193.12, 551036.77],
  ['ID91348', 'Büroohoone', 'Ida-Viru maakond, Jõhvi vald, Jõhvi linn, Rakvere tn 8', 6585087.65, 693771.97],
  ['LÄ40955', 'Rapla Kesklinna Kool', 'Rapla maakond, Rapla vald, Rapla linn, Keskkooli tn 2', 6540874.56, 545252.58],
  ['PÕ2149', 'Põhja-Tallinna Tegevuskeskus', 'Harju maakond, Tallinn, Põhja-Tallinna linnaosa, Sõle tn 61a', 6590440.74, 539498.57],
  ['LÄ 40956', 'Järvamaa Rakendusliku Kolledzi Särevere peamaja', 'Järva maakond, Türi vald, Särevere alevik, Tehnikumi tn 4', 6516745.01, 582721.26],
  ['PÕ68331', 'Tondiraba jalakäijate tunnel', 'Harju maakond, Tallinn, Lasnamäe linnaosa, Taevakivi tn 15', 6589572.02, 548751.95],
  ['PÕ13450', 'Mahla tn jalakäijate tunnel', 'Harju maakond, Tallinn, Nõmme linnaosa, Männiku tee T12', 6583643.8, 540897.46],
];

/* -------------------------------------------------------------------------- */
/* Address parsing                                                            */
/* -------------------------------------------------------------------------- */

function parseAddress(addr: string): { county: string; municipality: string } {
  // Estonian addresses are comma-separated, county first, municipality second.
  const parts = addr.split(',').map((p) => p.trim());
  return {
    county: parts[0] ?? '',
    municipality: parts[1] ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/* Build the frozen WGS84 dataset (one-time conversion at module evaluation)  */
/* -------------------------------------------------------------------------- */

function buildOfficialShelters(): OfficialShelter[] {
  const out: OfficialShelter[] = [];
  for (const [id, nimi, aadress, lestX, lestY] of RAW_ROWS) {
    // lest_x = northing, lest_y = easting (this is how the official CSV ships)
    const { lat, lng } = lest97ToWgs84(lestY, lestX);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 57 ||
      lat > 60 ||
      lng < 21 ||
      lng > 29
    ) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          `[officialShelters] dropping row ${id} — converted coords out of Estonia bbox`,
          { lat, lng, lestX, lestY },
        );
      }
      continue;
    }
    const { county, municipality } = parseAddress(aadress);
    out.push({
      id,
      name: nimi,
      address: aadress,
      municipality,
      county,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      type: 'SA3',
      source: 'Päästeamet',
      official: true,
      verified: true,
      dataSnapshotDate: '2026-05-16',
      originalProperties: { id, nimi, aadress, lest_x: lestX, lest_y: lestY },
    });
  }
  return out;
}

export const officialShelters: readonly OfficialShelter[] = Object.freeze(
  buildOfficialShelters(),
);

export type OfficialSheltersGeoJson = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: {
      id: string;
      name: string;
      address: string;
      municipality: string;
      county: string;
      type: 'SA3';
      source: 'Päästeamet';
    };
  }[];
};

export const officialSheltersGeoJson: OfficialSheltersGeoJson = Object.freeze({
  type: 'FeatureCollection',
  features: officialShelters.map((s) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] as [number, number] },
    properties: {
      id: s.id,
      name: s.name,
      address: s.address,
      municipality: s.municipality,
      county: s.county,
      type: s.type,
      source: s.source,
    },
  })),
}) as OfficialSheltersGeoJson;

/** Look up an official shelter by id. */
export function findOfficialShelterById(
  id: string,
): OfficialShelter | undefined {
  return officialShelters.find((s) => s.id === id);
}

/** Filter the dataset to a region preset. */
export type ShelterRegion = 'all' | 'tallinn' | 'harju' | 'near-me';

export function filterShelters(
  region: ShelterRegion,
  origin?: LatLng,
): OfficialShelter[] {
  if (region === 'tallinn') {
    return officialShelters.filter((s) =>
      s.county.toLowerCase().includes('harju') &&
      s.municipality.toLowerCase().includes('tallinn'),
    );
  }
  if (region === 'harju') {
    return officialShelters.filter((s) =>
      s.county.toLowerCase().includes('harju'),
    );
  }
  if (region === 'near-me' && origin) {
    // Cheap planar distance — good enough for ranking within Estonia.
    const KM_PER_DEG_LAT = 111.32;
    const kmPerDegLng = 111.32 * Math.cos((origin.lat * Math.PI) / 180);
    const scored = officialShelters
      .map((s) => {
        const dy = (s.lat - origin.lat) * KM_PER_DEG_LAT;
        const dx = (s.lng - origin.lng) * kmPerDegLng;
        return { s, d: Math.hypot(dx, dy) };
      })
      .toSorted((a, b) => a.d - b.d);
    return scored.slice(0, 60).map((x) => x.s);
  }
  return officialShelters.slice();
}
