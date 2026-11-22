import type { CitationsResult, MarkedResult, RubricInfo } from "./api/coursework";

/**
 * A made-up review of a made-up Biology IA, shown (marked "Example") to a
 * student who has not unlocked coursework reviews, so they see exactly what
 * one gives them. No real student's work is in here; the quotes are from an
 * invented investigation of catalase and temperature. Evidence offsets are 0:
 * a sample has no snapshot to point into.
 */
export const SAMPLE_RUBRIC: RubricInfo = {
  id: "sample",
  board: "IB",
  qualification: "IB Diploma",
  subject: "Biology",
  component: "Internal Assessment",
  componentKind: "internal_assessment",
  level: "SL/HL",
  sessionLabel: "first assessment 2025",
  totalMarks: 24,
  wordLimit: 3000,
  status: "reviewed",
  sourceNote: "",
};

export const SAMPLE_TITLE = "How does temperature affect the rate of catalase activity in potato tissue?";

export const SAMPLE_RESULT: MarkedResult = {
  schemaVersion: 1,
  mode: "marked",
  disclaimer:
    "This is an estimate from Scribe, not an official mark. Only your teacher and the exam board's examiners award marks, and the rubric used here is Scribe's paraphrase of the published criteria.",
  overall: {
    marksLow: 15,
    marksHigh: 19,
    totalMarks: 24,
    gradeLow: "5",
    gradeHigh: "6",
    summary: "A carefully run investigation with clear data processing. The conclusion claims more than five temperatures ten degrees apart can show, and the evaluation stays general.",
  },
  topFixes: [
    {
      title: "Say what your data can and can't show about the optimum",
      detail:
        "Your temperatures are 10 °C apart, so the peak could sit anywhere between 25 °C and 45 °C. State the range your results support, and say what extra readings would narrow it.",
      criterion: "C",
    },
    {
      title: "Compare your result with a published value, and cite it",
      detail: "You say your result agrees with the literature but give no value or source. Name the figure you are comparing with, where it comes from, and how far yours is from it.",
      criterion: "C",
    },
    {
      title: "Replace “human error” with specific weaknesses and their effect",
      detail: "For each weakness, say whether it would have raised or lowered the oxygen reading and roughly by how much. Then match each one to a realistic improvement.",
      criterion: "D",
    },
  ],
  criteria: [
    {
      letter: "A",
      name: "Research design",
      maxMarks: 6,
      bandLow: 4,
      bandHigh: 5,
      justification:
        "The research question is focused and names both variables with units. The method could be repeated, and the independent variable is controlled precisely. One controlled variable is described too loosely to be sure it was held constant.",
      evidence: [
        {
          quote: "The temperature of each water bath was held within ±1 °C using a digital thermometer",
          comment: "Precise control of the independent variable, with the tolerance stated.",
          start: 0,
          end: 0,
        },
        {
          quote: "Potato cylinders were cut to roughly the same size",
          comment: "“Roughly” leaves surface area uncontrolled, and it changes the rate directly.",
          start: 0,
          end: 0,
        },
      ],
      toMoveUp: "Give the dimensions and mass of the potato cylinders and how you kept them the same, and explain why five temperatures across this range were chosen.",
      droppedQuotes: 0,
      evidenceVerified: true,
    },
    {
      letter: "B",
      name: "Data analysis",
      maxMarks: 6,
      bandLow: 5,
      bandHigh: 6,
      justification:
        "Raw and processed data are recorded clearly with units and uncertainties. Means and standard deviations are calculated correctly, and the graph is appropriate with error bars explained.",
      evidence: [
        {
          quote: "the mean volume of oxygen rose from 4.1 cm³ at 15 °C to 14.6 cm³ at 35 °C",
          comment: "Processed data is quoted accurately to support the trend.",
          start: 0,
          end: 0,
        },
        {
          quote: "Error bars show ± one standard deviation across five trials",
          comment: "The reader is told what the error bars mean.",
          start: 0,
          end: 0,
        },
      ],
      toMoveUp: "Show one worked example of the rate calculation, and carry the uncertainty through to the rate rather than only the volume.",
      droppedQuotes: 0,
      evidenceVerified: true,
    },
    {
      letter: "C",
      name: "Conclusion",
      maxMarks: 6,
      bandLow: 3,
      bandHigh: 4,
      justification:
        "The conclusion answers the research question and follows the trend in the data. It overstates what the data shows about the optimum and refers to published values without giving one.",
      evidence: [
        {
          quote: "This proves that 35 °C is the optimum temperature for catalase",
          comment: "With readings every 10 °C the data cannot place the optimum this exactly, and “proves” is too strong.",
          start: 0,
          end: 0,
        },
        {
          quote: "which agrees with the literature value",
          comment: "No value or source is given, so the comparison cannot be checked.",
          start: 0,
          end: 0,
        },
      ],
      toMoveUp: "State the optimum as a range your data supports, and compare it with a cited published value, explaining any difference.",
      droppedQuotes: 0,
      evidenceVerified: true,
    },
    {
      letter: "D",
      name: "Evaluation",
      maxMarks: 6,
      bandLow: 3,
      bandHigh: 4,
      justification:
        "Weaknesses are identified, but in general terms, and their effect on the results is not discussed. One improvement is relevant and would work, but it is not explained.",
      evidence: [
        {
          quote: "The main limitation was human error when reading the gas syringe",
          comment: "A general statement: it does not say which way the error pushes the result.",
          start: 0,
          end: 0,
        },
        {
          quote: "Using a smaller temperature interval would improve the investigation",
          comment: "A good improvement. Say which interval and what it would let you conclude.",
          start: 0,
          end: 0,
        },
      ],
      toMoveUp: "Discuss the size and direction of each weakness, starting with the delay between adding the potato and sealing the flask, and link each to a specific improvement.",
      droppedQuotes: 0,
      evidenceVerified: true,
    },
  ],
  words: { counted: 2846, limit: 3000, overLimit: false, graded: 2846, bibliographyFound: true },
  flags: { quotesDropped: 0, rewritesRemoved: 0, bandsAdjusted: 0, marksRemoved: 0, notes: [] },
};

export const SAMPLE_CITATIONS: CitationsResult = {
  style: "APA",
  consistent: false,
  inconsistencies: ["Two in-text citations use numbers, like [3], while the rest use author and date."],
  citedNotListed: [{ text: "(Sharma & Li, 2019)", fix: "Add the full reference for Sharma & Li (2019) to your bibliography." }],
  listedNotCited: [{ text: "Campbell, N. A. (2020). Biology: A global approach (12th ed.). Pearson.", fix: "Cite it where you used it, or take it out of the bibliography." }],
  uncitedClaims: [
    { sentence: "Catalase is found in nearly all living organisms exposed to oxygen", kind: "claim", fix: "Add the source this comes from straight after the sentence." },
    { sentence: "Human catalase works fastest at about 37 °C", kind: "statistic", fix: "Give the source for this figure." },
  ],
  entries: [
    { index: 1, raw: "Sadava, D. (2017). Life: The science of biology (11th ed.). Sinauer.", missing: [], correctedFormat: null, lookup: null },
    {
      index: 2,
      raw: "Enzyme Education Trust. Catalase. https://enzyme-education.example/catalase",
      missing: ["date", "access_date"],
      correctedFormat: "Enzyme Education Trust. (n.d.). Catalase. Retrieved 4 November 2026, from https://enzyme-education.example/catalase",
      lookup: { kind: "url", status: "unverified", detail: "" },
    },
    {
      index: 4,
      raw: "Okafor, J. (2021). Thermal stability of plant catalases. Journal of Enzyme Studies, 14(2), 88–97. https://doi.org/10.5555/jes.2021.0142",
      missing: [],
      correctedFormat: null,
      lookup: { kind: "doi", status: "not_found", detail: "" },
    },
  ],
  counts: { inText: 9, entries: 5, issues: 7 },
  modelChecked: true,
  note: "",
};
