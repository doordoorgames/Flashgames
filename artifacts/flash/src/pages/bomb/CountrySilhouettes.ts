/**
 * Simplified SVG polygon paths for country silhouettes.
 * ViewBox: 0 0 100 100  (y increases downward)
 * Paths are approximate but shaped to be recognisable at small sizes.
 */
export const COUNTRY_PATHS: Record<string, string> = {
  Russia:
    "M 2,32 L 38,18 L 62,15 L 85,18 L 98,24 L 96,44 L 78,50 L 65,58 L 52,53 L 38,58 L 22,62 L 8,55 L 2,44 Z",

  Brazil:
    "M 18,5 L 55,8 L 82,18 L 90,42 L 85,65 L 68,82 L 48,92 L 28,85 L 10,62 L 8,35 Z",

  Japan:
    "M 60,5 L 78,10 L 85,24 L 80,38 L 68,52 L 52,65 L 40,76 L 32,70 L 46,55 L 58,40 L 55,22 Z",

  Australia:
    "M 12,35 L 30,22 L 50,18 L 65,20 L 75,15 L 86,26 L 90,50 L 82,72 L 65,88 L 40,90 L 18,76 L 8,55 Z",

  Italy:
    "M 38,4 L 52,4 L 56,18 L 60,32 L 66,46 L 72,60 L 76,72 L 68,80 L 58,74 L 52,62 L 46,50 L 42,38 L 36,22 Z",

  Chile:
    "M 36,2 L 50,4 L 56,22 L 60,42 L 60,62 L 56,80 L 46,96 L 38,96 L 36,80 L 40,62 L 40,42 L 38,22 Z",

  Argentina:
    "M 28,5 L 62,8 L 70,24 L 68,45 L 64,65 L 56,82 L 45,94 L 37,90 L 35,74 L 38,56 L 42,38 L 40,20 Z",

  Norway:
    "M 50,4 L 66,8 L 72,20 L 62,28 L 68,36 L 58,44 L 65,52 L 55,60 L 62,68 L 50,76 L 42,68 L 46,58 L 38,50 L 44,40 L 38,30 L 44,20 L 48,10 Z",

  India:
    "M 22,8 L 74,12 L 85,30 L 80,52 L 64,72 L 50,92 L 44,84 L 36,65 L 24,45 L 15,26 Z",

  France:
    "M 34,12 L 62,10 L 80,26 L 78,52 L 62,70 L 34,70 L 16,52 L 18,26 Z",

  Germany:
    "M 38,10 L 66,12 L 78,28 L 72,54 L 60,70 L 38,72 L 22,58 L 22,32 Z",

  Turkey:
    "M 5,30 L 95,24 L 97,44 L 90,56 L 68,58 L 45,58 L 22,60 L 8,52 L 3,40 Z",

  Egypt:
    "M 18,15 L 70,15 L 78,22 L 88,38 L 84,82 L 18,82 Z",

  "South Africa":
    "M 14,12 L 85,15 L 92,35 L 86,60 L 72,80 L 50,94 L 30,80 L 15,60 L 8,35 Z",

  China:
    "M 12,20 L 65,8 L 92,22 L 90,46 L 80,58 L 82,70 L 70,76 L 55,74 L 40,80 L 24,68 L 10,50 L 8,32 Z",

  "South Korea":
    "M 25,22 L 75,24 L 80,52 L 72,75 L 50,82 L 26,74 L 18,50 Z",

  Congo:
    "M 18,10 L 80,12 L 90,28 L 86,58 L 70,78 L 44,80 L 18,72 L 5,52 L 6,26 Z",

  "Saudi Arabia":
    "M 8,18 L 76,12 L 92,28 L 90,52 L 80,68 L 55,76 L 30,74 L 10,58 L 4,40 Z",

  Oman:
    "M 42,5 L 72,8 L 92,20 L 94,46 L 85,66 L 65,78 L 44,74 L 38,55 L 55,46 L 50,24 Z",

  Canada:
    "M 2,22 L 95,12 L 96,35 L 80,42 L 86,52 L 74,56 L 58,46 L 40,50 L 20,56 L 6,48 L 2,35 Z",

  Mexico:
    "M 4,24 L 68,16 L 84,26 L 92,40 L 86,52 L 74,60 L 60,58 L 46,66 L 38,76 L 22,72 L 6,56 L 4,40 Z",

  USA:
    "M 4,24 L 92,20 L 94,44 L 82,52 L 65,50 L 60,60 L 52,66 L 46,58 L 30,52 L 16,54 L 8,60 L 5,50 L 4,38 Z",

  Peru:
    "M 22,10 L 68,12 L 82,28 L 78,56 L 64,74 L 40,78 L 22,66 L 12,45 Z",

  Colombia:
    "M 16,10 L 68,8 L 84,22 L 82,44 L 68,58 L 50,66 L 28,62 L 12,48 L 12,26 Z",
};

export const COUNTRY_LIST = Object.keys(COUNTRY_PATHS);
