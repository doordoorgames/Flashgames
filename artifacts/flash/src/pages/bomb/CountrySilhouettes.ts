/**
 * SVG polygon paths for country silhouettes.
 * ViewBox: 0 0 100 100  (y increases downward)
 * Shaped to be recognisable at small sizes — key geographic features are exaggerated.
 */
export const COUNTRY_PATHS: Record<string, string> = {
  // Extremely wide east-west span
  Russia:
    "M 2,28 L 35,16 L 65,12 L 88,18 L 98,26 L 97,44 L 82,52 L 65,58 L 48,55 L 30,60 L 12,55 L 2,44 Z",

  // Large eastern bulge on the Atlantic coast
  Brazil:
    "M 20,5 L 58,8 L 82,18 L 90,34 L 88,52 L 80,68 L 68,82 L 52,94 L 34,90 L 18,78 L 10,60 L 8,40 Z",

  // Diagonal chain of islands NE→SW
  Japan:
    "M 62,6 L 76,12 L 82,22 L 72,34 L 60,46 L 48,58 L 36,70 L 28,66 L 40,52 L 54,40 L 66,26 L 60,14 Z",

  // Large island with Gulf of Carpentaria indent on north coast
  Australia:
    "M 14,32 L 28,22 L 42,16 L 52,12 L 54,20 L 62,14 L 72,14 L 84,24 L 90,40 L 88,58 L 80,74 L 66,88 L 48,92 L 32,86 L 18,72 L 8,54 Z",

  // The Boot — narrow shin, heel right, toe left
  Italy:
    "M 24,4 L 52,4 L 60,10 L 57,20 L 60,30 L 65,44 L 68,55 L 74,62 L 82,66 L 84,72 L 76,76 L 66,70 L 58,62 L 51,50 L 46,36 L 42,22 L 34,12 Z",

  // Extremely thin north-south strip
  Chile:
    "M 43,2 L 55,2 L 58,14 L 58,28 L 57,44 L 56,58 L 54,72 L 50,88 L 42,96 L 37,96 L 36,84 L 39,70 L 42,56 L 43,42 L 43,28 L 43,14 Z",

  // Large tapering triangle pointing south
  Argentina:
    "M 26,4 L 66,8 L 76,22 L 74,44 L 68,62 L 58,80 L 48,96 L 40,96 L 36,82 L 40,64 L 42,46 L 40,28 Z",

  // Very jagged western (fjord) coastline
  Norway:
    "M 50,4 L 64,6 L 72,12 L 64,18 L 72,26 L 62,32 L 70,40 L 58,46 L 66,54 L 54,62 L 62,70 L 50,78 L 44,70 L 48,60 L 40,54 L 46,44 L 38,36 L 44,26 L 36,18 L 44,10 Z",

  // Wide triangular peninsula pointing south
  India:
    "M 20,8 L 75,12 L 88,30 L 85,50 L 75,68 L 60,84 L 50,95 L 40,86 L 28,68 L 16,48 L 12,28 Z",

  // Rough hexagon
  France:
    "M 30,12 L 66,10 L 84,26 L 82,58 L 66,76 L 30,76 L 12,58 L 12,28 Z",

  // Slightly rectangular
  Germany:
    "M 36,10 L 68,10 L 80,28 L 78,58 L 66,76 L 36,76 L 20,58 L 20,30 Z",

  // Very elongated east-west rectangle
  Turkey:
    "M 4,30 L 96,22 L 98,40 L 92,55 L 72,62 L 48,62 L 24,62 L 8,56 L 3,42 Z",

  // Roughly square with triangular Sinai peninsula jutting NE
  Egypt:
    "M 16,15 L 65,15 L 72,20 L 88,34 L 86,44 L 70,40 L 74,84 L 16,84 Z",

  // Rounded triangle pointing south
  "South Africa":
    "M 14,12 L 85,15 L 94,35 L 88,58 L 72,80 L 55,95 L 38,82 L 18,62 L 6,38 Z",

  // Large irregular shape, wider in north
  China:
    "M 12,20 L 65,8 L 90,20 L 94,42 L 84,58 L 86,68 L 74,76 L 56,74 L 40,80 L 24,68 L 10,52 L 8,34 Z",

  // Small rounded oval
  "South Korea":
    "M 22,22 L 76,24 L 84,50 L 78,76 L 55,86 L 25,76 L 14,50 Z",

  // Very wide with curved southern border and Hudson Bay notch
  Canada:
    "M 2,20 L 94,10 L 97,28 L 84,38 L 90,50 L 76,56 L 58,48 L 40,52 L 22,58 L 6,52 L 2,35 Z",

  // Wide north tapering and bending into a hook
  Mexico:
    "M 4,22 L 70,14 L 86,24 L 94,40 L 88,54 L 76,60 L 62,58 L 48,66 L 38,78 L 26,74 L 8,56 L 4,38 Z",

  // Wide with Florida peninsula on bottom right
  USA:
    "M 4,24 L 88,18 L 96,32 L 88,42 L 78,44 L 76,54 L 72,66 L 64,68 L 60,58 L 48,46 L 36,50 L 24,56 L 14,54 L 8,62 L 5,52 L 4,38 Z",

  // Irregular with wide north, pointed southern tip
  "Saudi Arabia":
    "M 8,18 L 78,12 L 94,28 L 92,54 L 82,70 L 60,78 L 38,72 L 22,58 L 15,40 Z",
};

export const COUNTRY_LIST = Object.keys(COUNTRY_PATHS);
