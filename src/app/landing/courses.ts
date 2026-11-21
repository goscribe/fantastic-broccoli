/**
 * The course catalog as shown on the landing page: every course a student can
 * pick after signing up (server catalog, CATALOG_VERSION 3). Keep in step with
 * the catalog; courses.test.ts pins the count, so a catalog change that is not
 * mirrored here fails the tests rather than leaving a wrong number on the page.
 */
export const LANDING_BOARDS: { board: string; courses: string[] }[] = [
  {
    board: "IB Diploma",
    courses: [
      "IB Biology",
      "IB Chemistry",
      "IB Physics",
      "IB Mathematics: Analysis and Approaches",
      "IB Mathematics: Applications and Interpretation",
      "IB Economics",
      "IB Business Management",
      "IB History",
      "IB Computer Science",
      "IB Environmental Systems and Societies",
    ],
  },
  {
    board: "AP",
    courses: [
      "AP Biology",
      "AP Chemistry",
      "AP Physics 1",
      "AP Physics 2",
      "AP Calculus AB",
      "AP Calculus BC",
      "AP Statistics",
      "AP Macroeconomics",
      "AP Microeconomics",
      "AP Psychology",
      "AP US History",
      "AP World History: Modern",
      "AP US Government and Politics",
      "AP Human Geography",
      "AP Environmental Science",
    ],
  },
  {
    board: "A-level",
    courses: [
      "AQA A-level Biology",
      "AQA A-level Chemistry",
      "AQA A-level Physics",
      "AQA A-level Economics",
      "AQA A-level Business",
      "AQA A-level Psychology",
      "AQA A-level Sociology",
      "Edexcel A-level Mathematics",
      "Edexcel A-level Biology A (Salters-Nuffield)",
      "OCR A-level Biology A",
    ],
  },
  {
    board: "GCSE",
    courses: ["AQA GCSE Biology", "AQA GCSE Combined Science: Trilogy"],
  },
];

export const LANDING_COURSE_COUNT = LANDING_BOARDS.reduce((n, b) => n + b.courses.length, 0);
