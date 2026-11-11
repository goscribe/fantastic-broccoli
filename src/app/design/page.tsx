import Link from "next/link";

const SCREENS: [string, string][] = [
  ["Onboarding · goal", "/design/onboarding?step=1"],
  ["Onboarding · subjects", "/design/onboarding?step=2"],
  ["Onboarding · first material", "/design/onboarding?step=3"],
  ["Onboarding · building", "/design/onboarding?step=4"],
  ["Generating session (in app)", "/design/loading?step=1"],
  ["Session ready", "/design/loading?step=4"],
  ["Learn (self-directed)", "/design/learn"],
  ["Question · multiple choice", "/design/question?type=mcq"],
  ["Question · multiple choice · hint open", "/design/question?type=mcq&hint=1"],
  ["Question · multiple choice · wrong, with chat", "/design/question?type=mcq&state=fb&chat=1"],
  ["Question · panel collapsed", "/design/question?type=mcq&panel=closed"],
  ["Question · text (6 marks)", "/design/question?type=text"],
  ["Question · text · marked", "/design/question?type=text&state=fb"],
  ["Question · sketch", "/design/question?type=sketch"],
  ["Question · sketch · marked", "/design/question?type=sketch&state=fb"],
  ["Question · text · marked, tooltip open", "/design/question?type=text&state=fb&tip=1"],
  ["Question · numeric", "/design/question?type=numeric"],
  ["Question · numeric · marked", "/design/question?type=numeric&state=fb"],
  ["Question · true / false · marked", "/design/question?type=truefalse&state=fb"],
  ["Question · matching", "/design/question?type=matching"],
  ["Question · matching · marked", "/design/question?type=matching&state=fb"],
  ["Cloze · fill in the blank", "/design/question?type=cloze"],
  ["Cloze · marked", "/design/question?type=cloze&state=fb"],
  ["Comprehension · summary · marked", "/design/question?type=summary&state=fb"],
  ["Explain aloud · recording", "/design/question?type=explain"],
  ["Explain aloud · marked", "/design/question?type=explain&state=fb"],
  ["Explain · typed instead", "/design/question?type=explain&mode=type"],
  ["Lesson step complete (mobile)", "/design/complete"],
];

export default function DesignIndex() {
  return (
    <div className="mx-auto max-w-xl p-10">
      <h1 className="text-2xl font-bold">Redesign preview</h1>
      <p className="mt-1 text-sm text-muted-foreground">Static screens with mock data. Not linked from the app.</p>
      <ul className="mt-6 flex flex-col gap-2">{SCREENS.map(([l, h]) => <li key={h}><Link href={h} className="block rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted">{l}</Link></li>)}</ul>
    </div>
  );
}
